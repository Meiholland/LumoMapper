import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

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

  const response = NextResponse.redirect(new URL(next, origin));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    response.headers.set(
      "Location",
      new URL(
        "/?message=Missing%20Supabase%20credentials",
        origin,
      ).toString(),
    );
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );

  if (exchangeError) {
    response.headers.set(
      "Location",
      new URL(
        `/?message=${encodeURIComponent(exchangeError.message)}`,
        origin,
      ).toString(),
    );
    return response;
  }

  // Check if user is admin and redirect accordingly
  let redirectPath = nextParam ?? "/dashboard";
  if (!nextParam && sessionData?.session) {
    try {
      // Check admin status using the same supabase client
      const { data: users } = await supabase
        .from("users")
        .select("role")
        .eq("auth_user_id", sessionData.session.user.id)
        .limit(1)
        .single();

      if (users?.role === "admin") {
        redirectPath = "/admin";
      }
    } catch (err) {
      // If check fails, default to dashboard
      // console.error("Failed to check admin status:", err);
    }
  }

  response.headers.set("Location", new URL(redirectPath, origin).toString());
  return response;
}

