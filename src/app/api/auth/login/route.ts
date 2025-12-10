import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Server-side login handler
 * Handles authentication entirely on the server to avoid client/server cookie sync issues
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Missing Supabase credentials" },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return NextResponse.redirect(
        new URL("/?message=Email%20and%20password%20are%20required", request.url),
        302,
      );
    }

    const origin = new URL(request.url).origin;
    const isProduction = process.env.NODE_ENV === "production";
    const cookieStore = await cookies();

    // Create temporary response for cookie handling
    // We'll create the final redirect response after auth succeeds
    const tempResponse = NextResponse.next();

    // Create server client for authentication
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          // Try request cookies first, then cookieStore
          return request.cookies.get(name)?.value || cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          const secureOptions = {
            ...options,
            httpOnly: true,
            secure: isProduction || origin.startsWith("https://"),
            sameSite: "lax" as const,
            path: "/",
          };
          // Set in both cookieStore and tempResponse
          cookieStore.set({ name, value, ...secureOptions });
          tempResponse.cookies.set({ name, value, ...secureOptions });
        },
        remove(name: string, options: any) {
          const secureOptions = {
            ...options,
            httpOnly: true,
            secure: isProduction || origin.startsWith("https://"),
            sameSite: "lax" as const,
            path: "/",
            maxAge: 0,
          };
          cookieStore.set({ name, value: "", ...secureOptions });
          tempResponse.cookies.set({ name, value: "", ...secureOptions });
        },
      },
    });

    // Sign in server-side
    const {
      data: { user, session },
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !user || !session) {
      return NextResponse.redirect(
        new URL(
          `/?message=${encodeURIComponent(signInError?.message || "Login failed")}`,
          request.url,
        ),
        302,
      );
    }

    // Fetch user role and company to determine redirect
    const { data: userData } = await supabase
      .from("users")
      .select("role, company_id, companies(name)")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();

    // Extract company name
    let companyName: string | null = null;
    if (userData?.companies) {
      if (Array.isArray(userData.companies) && userData.companies.length > 0) {
        companyName = userData.companies[0]?.name ?? null;
      } else if (
        typeof userData.companies === "object" &&
        "name" in userData.companies
      ) {
        companyName = (userData.companies as { name: string }).name;
      }
    }

    // Fallback: fetch company separately if relation didn't work
    if (!companyName && userData?.company_id) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("name")
        .eq("id", userData.company_id)
        .single();
      companyName = companyData?.name ?? null;
    }

    // Determine redirect path
    let redirectPath = "/dashboard";
    if (companyName === "Lumo Labs") {
      redirectPath = "/admin";
    } else if (userData?.role === "admin") {
      redirectPath = "/admin";
    }

    // Create final redirect response
    const response = NextResponse.redirect(new URL(redirectPath, origin));

    // Copy all cookies from tempResponse (set by Supabase during signInWithPassword)
    // to the final redirect response
    const tempCookies = tempResponse.cookies.getAll();
    for (const cookie of tempCookies) {
      // Copy all cookies that were set during authentication
      const secureOptions = {
        httpOnly: true,
        secure: isProduction || origin.startsWith("https://"),
        sameSite: "lax" as const,
        path: "/",
      };
      response.cookies.set({
        name: cookie.name,
        value: cookie.value,
        ...secureOptions,
        maxAge: cookie.maxAge,
        expires: cookie.expires,
      });
    }

    // Also copy from cookieStore in case tempResponse missed any
    const storeCookies = cookieStore.getAll();
    for (const cookie of storeCookies) {
      if (cookie.name.includes("sb-") || cookie.name.includes("supabase")) {
        const secureOptions = {
          httpOnly: true,
          secure: isProduction || origin.startsWith("https://"),
          sameSite: "lax" as const,
          path: "/",
        };
        // Only set if not already in response
        if (!response.cookies.get(cookie.name)) {
          response.cookies.set({
            name: cookie.name,
            value: cookie.value,
            ...secureOptions,
          });
        }
      }
    }

    return response;
  } catch (error) {
    console.error("[LoginRoute] Error:", error);
    return NextResponse.redirect(
      new URL("/?message=An%20error%20occurred%20during%20login", request.url),
      302,
    );
  }
}
