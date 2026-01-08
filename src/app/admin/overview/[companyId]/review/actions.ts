"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { validateUUID } from "@/lib/validation";
import type { CategoryAxisData } from "@/app/dashboard/actions";
// import { GoogleGenerativeAI } from "@google/generative-ai"; // Commented out - using Azure AI instead
import { generateContentWithAzureAI } from "@/lib/azure-ai";

export type QuarterlyReviewInsight = {
  title: string;
  description: string;
  type: "improvement" | "decline" | "shift" | "correlation";
  category: string;
  pillar: string;
  change: number;
  current_score: number;
  previous_score: number;
};

export type QuarterlyReview = {
  executive_summary: string;
  insights: QuarterlyReviewInsight[];
  recommendations: string[];
};

/**
 * Get current and previous quarter assessments for a company
 */
export async function getQuarterlyAssessments(
  companyId: string,
  year: number,
  quarter: number,
) {
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

  const companyIdValidation = validateUUID(companyId, "company ID");
  if (companyIdValidation.error) {
    return { error: companyIdValidation.error };
  }

  try {
    // Get current quarter assessment
    const { data: currentPeriod, error: currentError } = await supabase
      .from("assessment_periods")
      .select("id, year, quarter, submitted_at")
      .eq("company_id", companyId)
      .eq("year", year)
      .eq("quarter", quarter)
      .single();

    if (currentError || !currentPeriod) {
      return { error: "Current quarter assessment not found" };
    }

    // Calculate previous quarter
    let prevYear = year;
    let prevQuarter = quarter - 1;
    if (prevQuarter < 1) {
      prevQuarter = 4;
      prevYear = year - 1;
    }

    // Get previous quarter assessment
    const { data: previousPeriod, error: previousError } = await supabase
      .from("assessment_periods")
      .select("id, year, quarter, submitted_at")
      .eq("company_id", companyId)
      .eq("year", prevYear)
      .eq("quarter", prevQuarter)
      .maybeSingle();

    if (previousError || !previousPeriod) {
      return { error: "Previous quarter assessment not found" };
    }

    // Fetch both assessments with scores
    const [currentResult, previousResult] = await Promise.all([
      getAssessmentWithScores(supabase, companyId, currentPeriod.id),
      getAssessmentWithScores(supabase, companyId, previousPeriod.id),
    ]);

    if (currentResult.error) return currentResult;
    if (previousResult.error) return previousResult;

    return {
      data: {
        current: currentResult.data!,
        previous: previousResult.data!,
        currentPeriod,
        previousPeriod,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load assessments",
    };
  }
}

async function getAssessmentWithScores(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  companyId: string,
  periodId: string,
) {
  // Check if company has company-specific questions
  const { data: companyQuestions } = await supabase
    .from("questions")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);

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

  const { data: responses, error: responsesError } = await supabase
    .from("assessment_responses")
    .select("question_id, score")
    .eq("assessment_period_id", periodId);

  if (responsesError) {
    return { error: "Failed to load responses" };
  }

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
    const categoryArray = Array.isArray(question.categories)
      ? question.categories
      : question.categories
        ? [question.categories]
        : [];
    const category = categoryArray[0];
    if (!category) continue;

    const response = responses?.find(
      (r: { question_id: string; score: number }) => r.question_id === question.id,
    );
    if (!response) continue;

    if (!categoryMap.has(category.id)) {
      categoryMap.set(category.id, {
        categoryId: category.id,
        categoryLabel: category.label,
        pillar: category.pillar,
        scores: [],
      });
    }

    categoryMap.get(category.id)!.scores.push(response.score);
  }

  const categories: CategoryAxisData[] = Array.from(categoryMap.values()).map(
    (cat) => {
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
    },
  );

  return {
    data: {
      categories,
    },
  };
}

/**
 * Get monthly reports for a quarter
 */
export async function getQuarterlyMonthlyReports(
  companyId: string,
  year: number,
  quarter: number,
) {
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
    // Calculate months in the quarter
    const monthsInQuarter: number[] = [];
    if (quarter === 1) monthsInQuarter.push(1, 2, 3);
    else if (quarter === 2) monthsInQuarter.push(4, 5, 6);
    else if (quarter === 3) monthsInQuarter.push(7, 8, 9);
    else monthsInQuarter.push(10, 11, 12);

    const { data: reports, error } = await supabase
      .from("monthly_reports")
      .select("*")
      .eq("company_id", companyId)
      .eq("year", year)
      .in("month", monthsInQuarter)
      .order("month", { ascending: true });

    if (error) {
      return { error: error.message };
    }

    return { data: reports || [] };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load monthly reports",
    };
  }
}

/**
 * Generate quarterly review using Gemini AI
 */
export async function generateQuarterlyReview(
  companyId: string,
  companyName: string,
  year: number,
  quarter: number,
) {
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

  // Azure AI configuration
  const azureEndpoint = process.env.AZURE_AI_ENDPOINT;
  const azureApiKey = process.env.AZURE_AI_API_KEY;
  const azureModelName = process.env.AZURE_AI_MODEL_NAME || "gpt-4o";
  const azureApiVersion = process.env.AZURE_AI_API_VERSION || "2025-04-01-preview";

  if (!azureEndpoint || !azureApiKey) {
    return {
      error:
        "Azure AI not configured. Please set AZURE_AI_ENDPOINT and AZURE_AI_API_KEY environment variables.",
    };
  }

  // Keep Gemini code commented for future use
  // const geminiApiKey = process.env.GEMINI_API_KEY;
  // if (!geminiApiKey) {
  //   return { error: "Gemini API key not configured" };
  // }

  try {
    // Check cache first
    const { data: cachedReview, error: cacheError } = await supabase
      .from("quarterly_reviews")
      .select("review_data")
      .eq("company_id", companyId)
      .eq("year", year)
      .eq("quarter", quarter)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!cacheError && cachedReview) {
      // Return cached review
      return { data: cachedReview.review_data as QuarterlyReview };
    }

    // Get assessments
    const assessmentsResult = await getQuarterlyAssessments(
      companyId,
      year,
      quarter,
    );
    if ("error" in assessmentsResult && assessmentsResult.error) {
      return { error: assessmentsResult.error };
    }
    if (!assessmentsResult.data) {
      return { error: "Failed to load assessments" };
    }

    const { current, previous, currentPeriod, previousPeriod } =
      assessmentsResult.data;

    // Get monthly reports
    const reportsResult = await getQuarterlyMonthlyReports(
      companyId,
      year,
      quarter,
    );
    const monthlyReports = reportsResult.data || [];

    // Format data for Gemini
    const currentData = formatAssessmentData(current.categories);
    const previousData = formatAssessmentData(previous.categories);
    const reportsData = formatMonthlyReports(monthlyReports);

    // Calculate previous quarter for display
    let prevYear = year;
    let prevQuarter = quarter - 1;
    if (prevQuarter < 1) {
      prevQuarter = 4;
      prevYear = year - 1;
    }

    // Build prompt
    const prompt = buildGeminiPrompt(
      companyName,
      year,
      quarter,
      prevYear,
      prevQuarter,
      currentData,
      previousData,
      reportsData,
    );

    // Call Azure AI API
    let text: string;
    try {
      text = await generateContentWithAzureAI(prompt, {
        endpoint: azureEndpoint,
        apiKey: azureApiKey,
        modelName: azureModelName,
        apiVersion: azureApiVersion,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        error: `Failed to generate review with Azure AI. Error: ${errorMessage}. Please verify your AZURE_AI_ENDPOINT, AZURE_AI_API_KEY, and AZURE_AI_API_VERSION are correct.`,
      };
    }

    // GEMINI CODE - Commented out for future use when quota is available
    // // Call Gemini API
    // // Try different model names as Google frequently updates availability
    // const genAI = new GoogleGenerativeAI(geminiApiKey);
    //
    // // List of models to try in order
    // // gemini-2.5-flash is the currently available model (as of 2025)
    // const modelsToTry = [
    //   "gemini-2.5-flash",
    //   "gemini-1.5-pro",
    //   "gemini-1.5-flash",
    //   "gemini-pro",
    //   "gemini-2.0-flash-exp",
    // ];
    //
    // let result;
    // let response;
    // let text;
    // let lastError: Error | null = null;
    //
    // for (const modelName of modelsToTry) {
    //   try {
    //     const model = genAI.getGenerativeModel({ model: modelName });
    //     result = await model.generateContent(prompt);
    //     response = await result.response;
    //     text = response.text();
    //     break; // Success, exit loop
    //   } catch (error) {
    //     lastError = error instanceof Error ? error : new Error(String(error));
    //     // Continue to next model
    //     continue;
    //   }
    // }
    //
    // if (!text) {
    //   // All models failed - provide helpful error message
    //   const errorMessage = lastError?.message || "Unknown error";
    //   return {
    //     error: `Failed to generate review with Gemini API. Tried models: ${modelsToTry.join(", ")}. Error: ${errorMessage}. Please verify your GEMINI_API_KEY is valid and has access to Gemini models. You can check available models at https://ai.google.dev/models`,
    //   };
    // }

    // Parse JSON response
    let review: QuarterlyReview;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      review = JSON.parse(jsonText);
    } catch (parseError) {
      // If JSON parsing fails, return raw text as executive summary
      review = {
        executive_summary: text,
        insights: [],
        recommendations: [],
      };
    }

    // Cache the review for 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await supabase
      .from("quarterly_reviews")
      .upsert(
        {
          company_id: companyId,
          year,
          quarter,
          review_data: review,
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "company_id,year,quarter" }
      );

    return { data: review };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to generate review",
    };
  }
}

function formatAssessmentData(categories: CategoryAxisData[]) {
  const byPillar: Record<string, Record<string, number>> = {};

  for (const category of categories) {
    if (!byPillar[category.pillar]) {
      byPillar[category.pillar] = {};
    }
    const score = category.axes[0]?.score ?? 0;
    byPillar[category.pillar][category.categoryLabel] = score;
  }

  return byPillar;
}

function formatMonthlyReports(reports: Array<{
  month: number;
  challenge_team: string | null;
  challenge_product: string | null;
  challenge_sales: string | null;
  challenge_marketing: string | null;
  challenge_finance: string | null;
  challenge_fundraise: string | null;
}>) {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return reports.map((report) => ({
    month: monthNames[report.month - 1],
    challenges: {
      team: report.challenge_team,
      product: report.challenge_product,
      sales: report.challenge_sales,
      marketing: report.challenge_marketing,
      finance: report.challenge_finance,
      fundraise: report.challenge_fundraise,
    },
  }));
}

function buildGeminiPrompt(
  companyName: string,
  currentYear: number,
  currentQuarter: number,
  previousYear: number,
  previousQuarter: number,
  currentData: Record<string, Record<string, number>>,
  previousData: Record<string, Record<string, number>>,
  monthlyReports: Array<{
    month: string;
    challenges: Record<string, string | null>;
  }>,
) {
  return `You are an expert portfolio analyst reviewing quarterly assessment data for venture-backed startups. Analyze the following data and provide insights.

## COMPANY CONTEXT
Company: ${companyName}
Current Quarter: Q${currentQuarter} ${currentYear}
Previous Quarter: Q${previousQuarter} ${previousYear}

## ASSESSMENT DATA

### Current Quarter (Q${currentQuarter} ${currentYear})
${JSON.stringify(currentData, null, 2)}

### Previous Quarter (Q${previousQuarter} ${previousYear})
${JSON.stringify(previousData, null, 2)}

## MONTHLY REPORTS (Latest Quarter)
${JSON.stringify(monthlyReports, null, 2)}

## ANALYSIS REQUIREMENTS

1. **Pattern Detection**: Identify meaningful changes (>1.0 point difference) between quarters
   - Flag categories that moved from weak (<2.5) to strong (>3.5)
   - Flag categories that dropped from strong (>3.5) to weak (<2.5)
   - Identify any category changes >1.0 points

2. **Leadership Shift Detection**: 
   - Compare "Product leadership" vs "Market leadership" scores within "BUSINESS CONCEPT & MARKET" pillar
   - If one was stronger than the other in previous quarter and this has reversed, flag this as a significant shift
   - Note the magnitude of the shift

3. **Correlation Analysis**:
   - Compare assessment score changes with monthly report challenges
   - If a category score decreased and that area appears in monthly challenges, highlight the correlation
   - If a category score increased despite challenges mentioned, note this as positive resilience

4. **Narrative Generation**:
   - Write a 2-3 sentence executive summary highlighting the most significant changes
   - Generate 3-5 key insights (each 1-2 sentences) focusing on:
     * Meaningful score changes (>1.0 points)
     * Leadership shifts (Product vs Market)
     * Correlations between assessment scores and monthly challenges
     * Areas of concern or strength

5. **Recommendations**:
   - Provide 2-3 very short, actionable recommendations (one sentence each)
   - Focus on addressing identified gaps or reinforcing strengths

## OUTPUT FORMAT

Provide your analysis in the following JSON structure:

{
  "executive_summary": "2-3 sentence summary here",
  "insights": [
    {
      "title": "Short insight title",
      "description": "1-2 sentence description",
      "type": "improvement|decline|shift|correlation",
      "category": "Category name",
      "pillar": "Pillar name",
      "change": 1.5,
      "current_score": 4.0,
      "previous_score": 2.5
    }
  ],
  "recommendations": [
    "Short actionable recommendation 1",
    "Short actionable recommendation 2"
  ]
}

Be concise, data-driven, and focus on actionable insights. Prioritize insights that show meaningful changes (>1.0 points) or interesting patterns.`;
}

