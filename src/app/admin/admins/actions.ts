"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { validateEmail } from "@/lib/validation";
import { createClient } from "@supabase/supabase-js";

/**
 * Get all users (for admin management)
 */
export async function getAllUsers() {
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
    // Get all users from public.users
    const { data: users, error } = await supabase
      .from("users")
      .select("id, full_name, role, auth_user_id, companies(name)")
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

    const usersWithEmails = await Promise.all(
      uniqueUsers.map(async (user) => {
        const { data: authUser } = await adminClient.auth.admin.getUserById(
          user.auth_user_id,
        );
        // Transform companies array to single object or null
        const company = Array.isArray(user.companies) 
          ? (user.companies.length > 0 ? user.companies[0] : null)
          : user.companies;
        
        return {
          id: user.id,
          auth_user_id: user.auth_user_id,
          full_name: user.full_name,
          role: user.role,
          email: authUser?.user?.email ?? "Unknown",
          companies: company,
        };
      }),
    );

    return { data: usersWithEmails };
  } catch (error) {
    // console.error("Failed to fetch users:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to load users",
    };
  }
}

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
        // Transform companies array to single object or null
        const company = Array.isArray(user.companies) 
          ? (user.companies.length > 0 ? user.companies[0] : null)
          : user.companies;
        
        return {
          id: user.id,
          full_name: user.full_name,
          role: user.role,
          email: authUser?.user?.email ?? "Unknown",
          companies: company,
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
 * Grant admin role to a user by auth_user_id
 */
export async function grantAdminRoleByAuthId(authUserId: string) {
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
    // Update all user records with this auth_user_id (in case of duplicates)
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: "admin" })
      .eq("auth_user_id", authUserId);

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
 * Revoke admin role from a user by auth_user_id
 */
export async function revokeAdminRoleByAuthId(authUserId: string) {
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
    // Update all user records with this auth_user_id (in case of duplicates)
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: "member" })
      .eq("auth_user_id", authUserId);

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

/**
 * Grant admin role to a user by email
 */
export async function grantAdminRole(email: string) {
  // Validate email format
  const emailValidation = validateEmail(email);
  if (emailValidation.error) {
    return { error: emailValidation.error };
  }

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

    // Find user by email - list users and filter
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      return { error: `Failed to list users: ${listError.message}` };
    }

    const authUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!authUser) {
      return { error: "User not found or access denied." };
    }

    // Update all user records with this auth_user_id (in case of duplicates)
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: "admin" })
      .eq("auth_user_id", authUser.id);

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
  // Validate email format
  const emailValidation = validateEmail(email);
  if (emailValidation.error) {
    return { error: emailValidation.error };
  }

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

    // Find user by email - list users and filter
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      return { error: `Failed to list users: ${listError.message}` };
    }

    const authUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (!authUser) {
      return { error: "User not found or access denied." };
    }

    // Update all user records with this auth_user_id (in case of duplicates)
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: "member" })
      .eq("auth_user_id", authUser.id);

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

