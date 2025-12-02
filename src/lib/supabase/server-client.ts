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

  type CookieHandler = NonNullable<
    Parameters<typeof createServerClient>[2]
  >["cookies"];

  const cookieHandler: CookieHandler = {
    async get(name) {
      const store = await cookies();
      return store.get(name)?.value;
    },
    async set(name, value, options) {
      // In Server Actions, cookies can only be read, not written
      // Cookie writes should happen in Route Handlers only
      // This is a no-op to prevent errors, but cookies won't be persisted
      // For session management, use Route Handlers for auth operations
      // Silently ignore cookie writes in Server Actions to prevent errors
    },
    async remove(name, options) {
      // In Server Actions, cookies can only be read, not written
      // This is a no-op to prevent errors
      // Silently ignore cookie removals in Server Actions to prevent errors
    },
  };

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: cookieHandler,
  });
}

