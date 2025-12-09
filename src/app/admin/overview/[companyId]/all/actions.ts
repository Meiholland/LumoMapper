"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { validateUUID } from "@/lib/validation";
import type { AssessmentWithScores, CategoryAxisData } from "@/app/dashboard/actions";

export async function getCompanyAllAssessments(companyId: string) {
  // Validate UUID
  const companyIdValidation = validateUUID(companyId, "company ID");
  if (companyIdValidation.error) {
    return { error: companyIdValidation.error };
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
    // Fetch company info
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return { error: "Company not found" };
    }

    // Fetch latest 3 assessments
    const { data: periods, error: periodsError } = await supabase
      .from("assessment_periods")
      .select("id, year, quarter, submitted_at")
      .eq("company_id", companyId)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false })
      .limit(3);

    if (periodsError) {
      return { error: "Failed to load assessments" };
    }

    if (!periods || periods.length === 0) {
      return { data: { companyName: company.name, assessments: [] } };
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

    // Fetch all responses for these assessments
    const periodIds = periods.map((p) => p.id);
    const { data: responses, error: responsesError } = await supabase
      .from("assessment_responses")
      .select("assessment_period_id, question_id, score")
      .in("assessment_period_id", periodIds);

    if (responsesError) {
      return { error: "Failed to load responses" };
    }

    // Build assessment summaries with aggregated scores
    const assessments: AssessmentWithScores[] = periods.map((period) => {
      const periodResponses = (responses || []).filter(
        (r) => r.assessment_period_id === period.id,
      );

      // Group questions by category and calculate average score per category
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

        const response = periodResponses.find(
          (r) => r.question_id === question.id,
        );
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

      return {
        assessment: {
          id: period.id,
          year: period.year,
          quarter: period.quarter,
          submitted_at: period.submitted_at,
        },
        categories,
      };
    });

    return {
      data: {
        companyName: company.name,
        assessments,
      },
    };
  } catch (error) {
    // console.error("Failed to fetch assessments:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to load assessments",
    };
  }
}

