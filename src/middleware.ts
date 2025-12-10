import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Simple in-memory rate limiting (for development/small scale)
// For production, consider using Redis-based rate limiting (e.g., @upstash/ratelimit)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 10 * 1000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per window

function getRateLimitKey(request: NextRequest): string {
  // Use IP address for rate limiting
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
  return `rate_limit_${ip}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    // Create new window
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW * 2);

export async function middleware(request: NextRequest) {
  // Apply rate limiting to API routes and server actions
  const pathname = request.nextUrl.pathname;

  // Skip rate limiting for static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Apply stricter rate limiting to auth endpoints
  const isAuthEndpoint = pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/");
  const maxRequests = isAuthEndpoint ? 10 : RATE_LIMIT_MAX_REQUESTS;

  const key = getRateLimitKey(request);
  const record = rateLimitMap.get(key);
  const now = Date.now();

  if (record && now <= record.resetTime) {
    if (record.count >= maxRequests) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((record.resetTime - now) / 1000)),
          },
        }
      );
    }
    record.count++;
  } else {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
  }

  // Refresh Supabase session to ensure cookies are synced
  // Only do this for non-API routes to avoid interfering with route handlers
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Skip session refresh for API routes (they handle their own auth)
  const isApiRoute = pathname.startsWith("/api/");
  
  if (supabaseUrl && supabaseAnonKey && !isApiRoute) {
    const response = NextResponse.next();
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // Set cookies with proper attributes
          const secureOptions = {
            ...options,
            httpOnly: options?.httpOnly ?? true,
            secure: process.env.NODE_ENV === "production" || request.url.startsWith("https://"),
            sameSite: "lax" as const,
            path: "/",
          };
          response.cookies.set({
            name,
            value,
            ...secureOptions,
          });
        },
        remove(name: string, options: any) {
          const secureOptions = {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" || request.url.startsWith("https://"),
            sameSite: "lax" as const,
            path: "/",
          };
          response.cookies.set({
            name,
            value: "",
            ...secureOptions,
          });
        },
      },
    });

    // Refresh session to ensure cookies are synced
    // This will read cookies from the request and refresh them if needed
    await supabase.auth.getSession();

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

