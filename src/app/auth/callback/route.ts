import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const error = searchParams.get("error");

  const redirectUrl = new URL(
    error
      ? `/?message=${encodeURIComponent(error)}`
      : `/?message=${encodeURIComponent("Account confirmed. You can log in.")}`,
    origin,
  );

  if (!code || error) {
    return NextResponse.redirect(
      error ? redirectUrl : new URL("/", origin),
      302,
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      new URL(
        "/?message=Missing%20Supabase%20credentials",
        origin,
      ),
      302,
    );
  }

  // Create response early so we can set cookies
  const response = NextResponse.redirect(new URL(nextParam ?? "/dashboard", origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        // Set cookies with proper attributes for cross-window scenarios
        response.cookies.set({ 
          name, 
          value, 
          ...options,
          sameSite: 'lax' as const,
          secure: origin.startsWith('https://'),
          httpOnly: options?.httpOnly ?? true,
        });
      },
      remove(name, options) {
        response.cookies.set({ 
          name, 
          value: "", 
          ...options,
          sameSite: 'lax' as const,
          secure: origin.startsWith('https://'),
          httpOnly: options?.httpOnly ?? true,
        });
      },
    },
  });

  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );

  if (exchangeError) {
    return NextResponse.redirect(
      new URL(
        `/?message=${encodeURIComponent(exchangeError.message)}`,
        origin,
      ),
      302,
    );
  }

  // Check if user is admin and redirect accordingly
  let redirectPath = nextParam ?? "/dashboard";
  if (!nextParam && sessionData?.session) {
    try {
      const userIsAdmin = await isAdmin(supabase, sessionData.session);
      if (userIsAdmin) {
        redirectPath = "/admin";
      }
    } catch (err) {
      // If admin check fails (e.g., user doesn't exist yet), default to dashboard
      // The dashboard will create the portal user on first access
    }
  }

  response.headers.set("Location", new URL(redirectPath, origin).toString());
  return response;
}
