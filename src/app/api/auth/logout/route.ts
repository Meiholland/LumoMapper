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
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        const secureOptions = {
          ...options,
          httpOnly: true,
          secure: isProduction || origin.startsWith('https://'),
          sameSite: 'lax' as const,
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
        };
        cookieStore.set({ name, value: "", ...secureOptions });
        response.cookies.set({ name, value: "", ...secureOptions });
      },
    },
  });

  await supabase.auth.signOut();

  return response;
}

