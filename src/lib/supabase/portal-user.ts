"use server";

import type { SupabaseClient, Session } from "@supabase/supabase-js";

export async function getOrCreatePortalUser(
  supabase: SupabaseClient,
  session: Session,
) {
  const authUserId = session.user.id;

  const { data: existingUsers, error: fetchError } = await supabase
    .from("users")
    .select("id, company_id, full_name")
    .eq("auth_user_id", authUserId);

  if (fetchError) {
    throw new Error(`Failed to load portal user: ${fetchError.message}`);
  }

  // Handle duplicate users (shouldn't happen, but handle gracefully)
  if (existingUsers && existingUsers.length > 1) {
    // console.warn(
    //   `[PortalUser] Multiple users found for auth_user_id ${authUserId}, using the first one`,
    // );
    // Return the first one, or you could delete duplicates
    return existingUsers[0];
  }

  const existing = existingUsers && existingUsers.length === 1 ? existingUsers[0] : null;

  if (existing) return existing;

  const companyName = session.user.user_metadata?.company_name;
  if (!companyName) {
    throw new Error(
      "Your profile is missing a company selection. Please contact support.",
    );
  }

  // Escape special characters in company name to prevent pattern injection
  function escapeLikePattern(input: string): string {
    return input.replace(/[%_]/g, '\\$&');
  }

  const { data: companies, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", escapeLikePattern(companyName))
    .limit(2);

  if (companyError) {
    throw new Error(
      `Failed to lookup company: ${companyError.message}`,
    );
  }

  if (!companies || companies.length === 0) {
    throw new Error(
      `Unable to find a portfolio company named "${companyName}".`,
    );
  }

  if (companies.length > 1) {
    throw new Error(
      `Multiple companies match "${companyName}". Please be more specific.`,
    );
  }

  const company = companies[0];

  const fullName =
    session.user.user_metadata?.full_name ?? session.user.email ?? "Founder";

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      auth_user_id: authUserId,
      full_name: fullName,
      company_id: company.id,
    })
    .select("id, company_id, full_name")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Failed to create your portal profile: ${insertError?.message}`,
    );
  }

  return inserted;
}

