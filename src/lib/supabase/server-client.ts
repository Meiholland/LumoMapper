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

  const cookieHandler = {
    get(name: string) {
      return cookieStore.get(name)?.value;
    },
    set(name: string, value: string, options: any) {
      // In Server Components, cookies can only be read, not written
      // Cookie writes should happen in Route Handlers only
      // This is a no-op to prevent errors, but cookies won't be persisted
      // For session management, use Route Handlers for auth operations
      // Silently ignore cookie writes in Server Components to prevent errors
    },
    remove(name: string, options: any) {
      // In Server Components, cookies can only be read, not written
      // This is a no-op to prevent errors
      // Silently ignore cookie removals in Server Components to prevent errors
    },
  };

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: cookieHandler,
  });
}

