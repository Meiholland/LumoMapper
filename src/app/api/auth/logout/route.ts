import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Missing Supabase credentials" },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL("/", request.url));

  const origin = new URL(request.url).origin;
  const isProduction = process.env.NODE_ENV === 'production';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // Try request cookies first (set by client-side), then cookieStore
        const requestCookie = request.cookies.get(name)?.value;
        if (requestCookie) return requestCookie;
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        const secureOptions = {
          ...options,
          httpOnly: true,
          secure: isProduction || origin.startsWith('https://'),
          sameSite: 'lax' as const,
          path: '/',
        };
        cookieStore.set({ name, value, ...secureOptions });
        response.cookies.set({ name, value, ...secureOptions });
      },
      remove(name: string, options: any) {
        const secureOptions = {
          ...options,
          httpOnly: true,
          secure: isProduction || origin.startsWith('https://'),
          sameSite: 'lax' as const,
          path: '/',
          maxAge: 0, // Explicitly expire the cookie
        };
        // Clear from both cookieStore and response
        cookieStore.set({ name, value: "", ...secureOptions });
        response.cookies.set({ name, value: "", ...secureOptions });
        // Also delete from request cookies if present
        request.cookies.delete(name);
      },
    },
  });

  // Sign out - this will clear all auth cookies
  await supabase.auth.signOut();
  
  // Explicitly clear any remaining Supabase cookies by name pattern
  // Supabase uses cookies like sb-<project-ref>-auth-token
  const allCookies = request.cookies.getAll();
  for (const cookie of allCookies) {
    if (cookie.name.includes('sb-') || cookie.name.includes('supabase')) {
      const secureOptions = {
        httpOnly: true,
        secure: isProduction || origin.startsWith('https://'),
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 0,
      };
      response.cookies.set({ name: cookie.name, value: "", ...secureOptions });
      cookieStore.set({ name: cookie.name, value: "", ...secureOptions });
    }
  }

  return response;
}

