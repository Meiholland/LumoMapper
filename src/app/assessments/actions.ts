"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { getOrCreatePortalUser } from "@/lib/supabase/portal-user";

export type AssessmentPayload = {
  year: number;
  quarter: number;
  answers: Record<string, number>;
};

/**
 * Gets the most recent assessment scores before the specified year/quarter.
 * Returns a map of question_id -> score, or null if no previous assessment exists.
 */
export async function getPreviousAssessmentScores(
  year: number,
  quarter: number,
) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  try {
    // Create a session-like object for getOrCreatePortalUser
    const session = {
      user: {
        id: user.id,
        user_metadata: user.user_metadata || {},
        email: user.email,
      },
    } as any;
    
    const portalUser = await getOrCreatePortalUser(supabase, session);
    if (!portalUser.company_id) {
      return { error: "No company assigned" };
    }

    // Always get the most recent assessment, excluding the current period if it exists
    const { data: allPeriods, error: allPeriodsError } = await supabase
      .from("assessment_periods")
      .select("id, year, quarter")
      .eq("company_id", portalUser.company_id)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });

    if (allPeriodsError) {
      console.error("[getPreviousAssessmentScores] Error loading periods:", allPeriodsError);
      return { error: "Failed to load previous assessments" };
    }

    if (!allPeriods || allPeriods.length === 0) {
      console.log("[getPreviousAssessmentScores] No periods found for company");
      return { data: null };
    }

    console.log(`[getPreviousAssessmentScores] Found ${allPeriods.length} periods. Looking for most recent assessment (current: Q${quarter} ${year})`);
    console.log(`[getPreviousAssessmentScores] All periods:`, allPeriods.map(p => `Q${p.quarter} ${p.year}`));

    // Check if current period already exists
    const currentPeriodExists = allPeriods.some(
      (p) => p.year === year && p.quarter === quarter,
    );

    // If current period exists, use it as the "previous" (for editing)
    // Otherwise, use the most recent period
    const prevPeriod = currentPeriodExists
      ? allPeriods.find((p) => p.year === year && p.quarter === quarter)
      : allPeriods[0]; // Most recent period

    if (!prevPeriod) {
      console.log(`[getPreviousAssessmentScores] No periods found`);
      return { data: null };
    }

    console.log(`[getPreviousAssessmentScores] Using period: Q${prevPeriod.quarter} ${prevPeriod.year}${currentPeriodExists ? ' (current period, editing mode)' : ' (previous period)'}`);

    // Fetch responses for the previous period
    const { data: responses, error: responsesError } = await supabase
      .from("assessment_responses")
      .select("question_id, score")
      .eq("assessment_period_id", prevPeriod.id);

    if (responsesError) {
      console.error("[getPreviousAssessmentScores] Error loading responses:", responsesError);
      return { error: "Failed to load previous responses" };
    }

    console.log(`[getPreviousAssessmentScores] Found ${responses?.length || 0} responses for period ${prevPeriod.id}`);

    // Convert to a map of question_id -> score
    const scoresMap = Object.fromEntries(
      (responses || []).map((r) => [r.question_id, r.score]),
    );

    console.log(`[getPreviousAssessmentScores] Returning ${Object.keys(scoresMap).length} scores`);
    return { data: scoresMap };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unexpected error while loading previous assessment.",
    };
  }
}

export async function submitAssessment(payload: AssessmentPayload) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return { error: "Please sign in again to submit an assessment." };
  }

  if (!payload.year || !payload.quarter) {
    return { error: "Select a year and quarter before submitting." };
  }

  const quarter = Number(payload.quarter);
  if (Number.isNaN(quarter) || quarter < 1 || quarter > 4) {
    return { error: "Quarter must be between Q1 and Q4." };
  }

  try {
    const portalUser = await getOrCreatePortalUser(supabase, session);
    if (!portalUser.company_id) {
      return {
        error:
          "Your profile is missing a company assignment. Please contact support.",
      };
    }

    const { data: period, error: periodError } = await supabase
      .from("assessment_periods")
      .insert({
        company_id: portalUser.company_id,
        year: payload.year,
        quarter,
        submitted_by: portalUser.id,
      })
      .select("id")
      .single();

    if (periodError || !period) {
      if (periodError?.code === "23505") {
        return {
          error: `You've already submitted Q${quarter} ${payload.year}.`,
        };
      }
      throw new Error(periodError?.message ?? "Failed to create assessment.");
    }

    const responses = Object.entries(payload.answers).map(
      ([questionId, score]) => ({
        assessment_period_id: period.id,
        question_id: questionId,
        score,
      }),
    );

    const { error: responsesError } = await supabase
      .from("assessment_responses")
      .insert(responses);

    if (responsesError) {
      throw new Error(responsesError.message);
    }

    revalidatePath("/dashboard");
    revalidatePath("/assessments/new");
    return { success: true };
  } catch (error) {
    // console.error("Assessment submission failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unexpected error while saving assessment.",
    };
  }
}

