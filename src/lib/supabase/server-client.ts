"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  // Get cookies synchronously - cookies() returns a promise in Next.js 15+
  const cookieStore = await cookies();

  // Debug: log cookie values (truncated for security)
  const authTokenCookie = cookieStore.get('sb-bptzwswjouezzzypwysd-auth-token');
  console.log("[ServerClient] Cookie check:", {
    hasAuthToken: !!authTokenCookie,
    authTokenLength: authTokenCookie?.value?.length,
    authTokenPreview: authTokenCookie?.value?.substring(0, 50),
  });

  const cookieHandler = {
    get(name: string) {
      const value = cookieStore.get(name)?.value;
      console.log(`[ServerClient] Cookie get: ${name} = ${value ? 'present' : 'missing'}`);
      return value;
    },
    set(name: string, value: string, options: any) {
      // In Server Components, cookies can only be read, not written
      // Cookie writes should happen in Route Handlers only
      // This is a no-op to prevent errors, but cookies won't be persisted
      // For session management, use Route Handlers for auth operations
      // Silently ignore cookie writes in Server Components to prevent errors
      console.log(`[ServerClient] Cookie set attempted (ignored): ${name}`);
    },
    remove(name: string, options: any) {
      // In Server Components, cookies can only be read, not written
      // This is a no-op to prevent errors
      // Silently ignore cookie removals in Server Components to prevent errors
      console.log(`[ServerClient] Cookie remove attempted (ignored): ${name}`);
    },
  };

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: cookieHandler,
  });

  // Try to get user directly to debug
  const { data: { user }, error: userError } = await client.auth.getUser();
  console.log("[ServerClient] Direct getUser check:", {
    hasUser: !!user,
    userId: user?.id,
    userError: userError?.message,
  });

  return client;
}

