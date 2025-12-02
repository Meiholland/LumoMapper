"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { getOrCreatePortalUser } from "@/lib/supabase/portal-user";

export type AssessmentPayload = {
  year: number;
  quarter: number;
  answers: Record<string, number>;
};

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

