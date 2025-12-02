"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

/**
 * Get all admin users
 */
export async function getAllAdmins() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const userIsAdmin = await isAdmin(supabase, session);
  if (!userIsAdmin) {
    return { error: "Not authorized" };
  }

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, full_name, role, auth_user_id, companies(name)")
      .eq("role", "admin")
      .order("full_name");

    if (error) {
      return { error: error.message };
    }

    // Deduplicate by auth_user_id (keep the first one if duplicates exist)
    const seen = new Set<string>();
    const uniqueUsers = (users || []).filter((user) => {
      if (seen.has(user.auth_user_id)) {
        return false;
      }
      seen.add(user.auth_user_id);
      return true;
    });

    // Get emails from auth.users using service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return { error: "Missing service role key" };
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const adminEmails = await Promise.all(
      uniqueUsers.map(async (user) => {
        const { data: authUser } = await adminClient.auth.admin.getUserById(
          user.auth_user_id,
        );
        return {
          ...user,
          email: authUser?.user?.email ?? "Unknown",
        };
      }),
    );

    return { data: adminEmails };
  } catch (error) {
    // console.error("Failed to fetch admins:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to load admins",
    };
  }
}

/**
 * Grant admin role to a user by email
 */
export async function grantAdminRole(email: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const userIsAdmin = await isAdmin(supabase, session);
  if (!userIsAdmin) {
    return { error: "Not authorized" };
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return { error: "Missing service role key" };
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Find user by email
    const { data: authUser, error: authError } =
      await adminClient.auth.admin.getUserByEmail(email);

    if (authError || !authUser?.user) {
      return { error: "User not found. They must sign up first." };
    }

    // Update all user records with this auth_user_id (in case of duplicates)
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: "admin" })
      .eq("auth_user_id", authUser.user.id);

    if (updateError) {
      return { error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    // console.error("Failed to grant admin role:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to grant admin access",
    };
  }
}

/**
 * Revoke admin role from a user by email
 */
export async function revokeAdminRole(email: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const userIsAdmin = await isAdmin(supabase, session);
  if (!userIsAdmin) {
    return { error: "Not authorized" };
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return { error: "Missing service role key" };
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Find user by email
    const { data: authUser, error: authError } =
      await adminClient.auth.admin.getUserByEmail(email);

    if (authError || !authUser?.user) {
      return { error: "User not found" };
    }

    // Update all user records with this auth_user_id (in case of duplicates)
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: "member" })
      .eq("auth_user_id", authUser.user.id);

    if (updateError) {
      return { error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    // console.error("Failed to revoke admin role:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to revoke admin access",
    };
  }
}

