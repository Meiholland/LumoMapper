"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { getOrCreatePortalUser } from "@/lib/supabase/portal-user";

export type AssessmentSummary = {
  id: string;
  year: number;
  quarter: number;
  submitted_at: string;
};

export type CategoryAxisData = {
  categoryId: string;
  categoryLabel: string;
  pillar: string;
  axes: Array<{
    label: string;
    score: number;
  }>;
};

export type AssessmentWithScores = {
  assessment: AssessmentSummary;
  categories: CategoryAxisData[];
};

export async function getLatestAssessments(limit = 3) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  try {
    const portalUser = await getOrCreatePortalUser(supabase, session);
    if (!portalUser.company_id) {
      return { error: "No company assigned" };
    }

    // Explicitly verify company_id matches user's record for data isolation
    const { data: userRecord } = await supabase
      .from("users")
      .select("company_id")
      .eq("auth_user_id", session.user.id)
      .single();

    if (userRecord?.company_id !== portalUser.company_id) {
      return { error: "Company access verification failed" };
    }

    // Fetch latest assessments
    const { data: periods, error: periodsError } = await supabase
      .from("assessment_periods")
      .select("id, year, quarter, submitted_at, company_id")
      .eq("company_id", portalUser.company_id)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false })
      .limit(limit);

    if (periodsError) {
      console.error("[Dashboard] Error fetching assessment periods:", periodsError);
      return { error: "Failed to load assessments" };
    }

    if (!periods || periods.length === 0) {
      // Debug: Check if assessments exist for this company at all
      const { data: allPeriodsForCompany } = await supabase
        .from("assessment_periods")
        .select("id, year, quarter, company_id")
        .eq("company_id", portalUser.company_id);
      
      // Debug: Check what company name this company_id corresponds to
      const { data: companyInfo } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", portalUser.company_id)
        .single();
      
      // Debug: Check all companies to see if there's a name mismatch
      const { data: allCompanies } = await supabase
        .from("companies")
        .select("id, name");
      
      // Debug: Check all assessment periods to see what companies have assessments
      const { data: allPeriods } = await supabase
        .from("assessment_periods")
        .select("id, year, quarter, company_id");
      
      console.error("[Dashboard] No assessments found - Debug info:", {
        userCompanyId: portalUser.company_id,
        userCompanyName: companyInfo?.name,
        totalAssessmentsForThisCompany: allPeriodsForCompany?.length ?? 0,
        allCompanies: allCompanies?.map(c => ({ id: c.id, name: c.name })),
        assessmentsByCompany: allPeriods?.reduce((acc, p) => {
          acc[p.company_id] = (acc[p.company_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });
      
      return { data: [] };
    }

    // Check if company has company-specific questions
    const { data: companyQuestions } = await supabase
      .from("questions")
      .select("id")
      .eq("company_id", portalUser.company_id)
      .limit(1);

    console.log("[Dashboard] Company questions check:", {
      hasCompanyQuestions: companyQuestions && companyQuestions.length > 0,
      companyId: portalUser.company_id,
    });

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
      // Company has custom questions, use those
      questionsQuery.eq("company_id", portalUser.company_id);
    } else {
      // No custom questions, use standard questions
      questionsQuery.is("company_id", null);
    }

    let { data: questions, error: questionsError } = await questionsQuery;

    if (questionsError || !questions) {
      console.error("[Dashboard] Questions query error:", questionsError);
      return { error: "Failed to load questions" };
    }

    console.log("[Dashboard] Questions loaded:", {
      count: questions?.length ?? 0,
      questionIds: questions?.map(q => q.id).slice(0, 5),
    });

    // Fetch all responses for these assessments
    const periodIds = periods.map((p) => p.id);
    const { data: responses, error: responsesError } = await supabase
      .from("assessment_responses")
      .select("assessment_period_id, question_id, score")
      .in("assessment_period_id", periodIds);

    if (responsesError) {
      console.error("[Dashboard] Responses query error:", responsesError);
      return { error: "Failed to load responses" };
    }

    console.log("[Dashboard] Responses loaded:", {
      count: responses?.length ?? 0,
      periodIds,
      responseQuestionIds: responses?.map(r => r.question_id).slice(0, 10),
    });

    // If we have responses but no questions, try querying questions by the response question_ids
    if (responses && responses.length > 0 && (!questions || questions.length === 0)) {
      const uniqueQuestionIds = [...new Set(responses.map(r => r.question_id))];
      console.log("[Dashboard] No questions found via category join, trying direct query by question IDs:", {
        uniqueQuestionIds: uniqueQuestionIds.slice(0, 10),
      });

      // Try fetching questions directly by their IDs (without join first)
      const { data: directQuestions, error: directError } = await supabase
        .from("questions")
        .select("id, prompt, sequence, category_id")
        .in("id", uniqueQuestionIds)
        .order("sequence");

      if (!directError && directQuestions && directQuestions.length > 0) {
        // Fetch categories separately
        const categoryIds = [...new Set(directQuestions.map(q => q.category_id).filter(Boolean))];
        const { data: categoriesData } = await supabase
          .from("categories")
          .select("id, label, pillar")
          .in("id", categoryIds);

        const categoryMap = new Map((categoriesData || []).map(c => [c.id, c]));

        // Combine questions with their categories
        questions = directQuestions.map(q => ({
          id: q.id,
          prompt: q.prompt,
          sequence: q.sequence,
          categories: q.category_id && categoryMap.has(q.category_id)
            ? [categoryMap.get(q.category_id)!]
            : [],
        })) as typeof questions;

        console.log("[Dashboard] Found questions via direct query:", questions.length, "with categories");
      }
    }

    if (!questions || questions.length === 0) {
      console.error("[Dashboard] No questions found after all attempts");
      return { error: "No questions found for assessments" };
    }

    // Build assessment summaries with aggregated scores
    const assessments: AssessmentWithScores[] = periods.map((period) => {
      const periodResponses = (responses || []).filter(
        (r) => r.assessment_period_id === period.id,
      );

      // Group questions by category and calculate average score per category
      // Only include questions that have responses (since we create questions on-the-fly from imports)
      const categoryMap = new Map<
        string,
        {
          categoryId: string;
          categoryLabel: string;
          pillar: string;
          scores: number[];
        }
      >();

      let questionsWithResponses = 0;
      let questionsWithoutResponses = 0;
      let questionsWithoutCategories = 0;

      for (const question of questions) {
        // Handle categories as array (Supabase returns it as array for relations)
        const categoryArray = Array.isArray(question.categories) 
          ? question.categories 
          : question.categories 
            ? [question.categories] 
            : [];
        const category = categoryArray[0];
        if (!category) {
          questionsWithoutCategories++;
          continue;
        }

        const response = periodResponses.find(
          (r) => r.question_id === question.id,
        );
        
        // Only include questions that have responses
        if (!response) {
          questionsWithoutResponses++;
          continue;
        }

        questionsWithResponses++;
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

      console.log(`[Dashboard] Period ${period.id} (Q${period.quarter} ${period.year}):`, {
        totalQuestions: questions.length,
        questionsWithResponses,
        questionsWithoutResponses,
        questionsWithoutCategories,
        periodResponseCount: periodResponses.length,
        categoriesFound: categoryMap.size,
      });

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

    return { data: assessments };
  } catch (error) {
    // console.error("Failed to fetch assessments:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to load assessments",
    };
  }
}

