"use server";

import { getSupabaseServerClient } from "./server-client";
import { isAdmin } from "./admin";

/**
 * Check if the current user is an admin and return the appropriate redirect path
 */
export async function getRedirectPathForUser(): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return "/dashboard";
  }

  const userIsAdmin = await isAdmin(supabase, session);
  return userIsAdmin ? "/admin" : "/dashboard";
}

