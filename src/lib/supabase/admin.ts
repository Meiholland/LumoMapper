"use server";

import type { SupabaseClient, Session } from "@supabase/supabase-js";

/**
 * Check if the current user is an admin
 */
export async function isAdmin(
  supabase: SupabaseClient,
  session: Session | null,
): Promise<boolean> {
  if (!session) {
    return false;
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", session.user.id)
    .limit(1);

  if (error || !users || users.length === 0) {
    return false;
  }

  return users[0].role === "admin";
}

