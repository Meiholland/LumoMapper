"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { validateUUID } from "@/lib/validation";
import type { AssessmentWithScores, CategoryAxisData } from "@/app/dashboard/actions";

export async function getCompanyAssessment(
  companyId: string,
  periodId: string,
) {
  // Validate UUIDs
  const companyIdValidation = validateUUID(companyId, "company ID");
  if (companyIdValidation.error) {
    return { error: companyIdValidation.error };
  }

  const periodIdValidation = validateUUID(periodId, "period ID");
  if (periodIdValidation.error) {
    return { error: periodIdValidation.error };
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
    // Fetch the assessment period
    const { data: period, error: periodError } = await supabase
      .from("assessment_periods")
      .select("id, company_id, year, quarter, submitted_at, companies(name)")
      .eq("id", periodId)
      .eq("company_id", companyId)
      .single();

    if (periodError || !period) {
      return { error: "Assessment not found" };
    }

    // Check if company has company-specific questions
    const { data: companyQuestions } = await supabase
      .from("questions")
      .select("id")
      .eq("company_id", companyId)
      .limit(1);

    // Fetch questions: company-specific if they exist, otherwise standard
    const questionsQuery = supabase
      .from("questions")
      .select(
        `
        id,
        prompt,
        sequence,
        categories!inner (
          id,
          label,
          pillar
        )
      `,
      )
      .order("sequence");

    if (companyQuestions && companyQuestions.length > 0) {
      questionsQuery.eq("company_id", companyId);
    } else {
      questionsQuery.is("company_id", null);
    }

    const { data: questions, error: questionsError } = await questionsQuery;

    if (questionsError || !questions) {
      return { error: "Failed to load questions" };
    }

    // Fetch responses for this assessment
    const { data: responses, error: responsesError } = await supabase
      .from("assessment_responses")
      .select("question_id, score")
      .eq("assessment_period_id", periodId);

    if (responsesError) {
      return { error: "Failed to load responses" };
    }

    // Build assessment summary with aggregated scores
    const categoryMap = new Map<
      string,
      {
        categoryId: string;
        categoryLabel: string;
        pillar: string;
        scores: number[];
      }
    >();

    for (const question of questions) {
      // Handle categories as array (Supabase returns it as array for relations)
      const categoryArray = Array.isArray(question.categories) 
        ? question.categories 
        : question.categories 
          ? [question.categories] 
          : [];
      const category = categoryArray[0];
      if (!category) continue;

      const response = responses?.find((r) => r.question_id === question.id);
      if (!response) continue;

      const score = response.score;

      if (!categoryMap.has(category.id)) {
        categoryMap.set(category.id, {
          categoryId: category.id,
          categoryLabel: category.label,
          pillar: category.pillar,
          scores: [],
        });
      }

      categoryMap.get(category.id)!.scores.push(score);
    }

    // Convert to final format: each category becomes an axis with its average score
    const categories: CategoryAxisData[] = Array.from(
      categoryMap.values(),
    ).map((cat) => {
      const avgScore =
        cat.scores.length > 0
          ? cat.scores.reduce((sum, s) => sum + s, 0) / cat.scores.length
          : 0;
      return {
        categoryId: cat.categoryId,
        categoryLabel: cat.categoryLabel,
        pillar: cat.pillar,
        axes: [
          {
            label: cat.categoryLabel,
            score: avgScore,
          },
        ],
      };
    });

    const assessment: AssessmentWithScores = {
      assessment: {
        id: period.id,
        year: period.year,
        quarter: period.quarter,
        submitted_at: period.submitted_at,
      },
      categories,
    };

    // Handle companies as array (Supabase returns it as array for relations)
    const companyArray = Array.isArray(period.companies) 
      ? period.companies 
      : period.companies 
        ? [period.companies] 
        : [];
    const company = companyArray[0];

    return {
      data: {
        assessment,
        companyName: company?.name ?? "Unknown Company",
      },
    };
  } catch (error) {
    // console.error("Failed to fetch assessment:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to load assessment",
    };
  }
}

