import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { getOrCreatePortalUser } from "@/lib/supabase/portal-user";

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check dashboard assessment loading
 * Visit /api/debug/dashboard while logged in
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const portalUser = await getOrCreatePortalUser(supabase, session);
    
    // Get company info
    const { data: companyInfo } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", portalUser.company_id)
      .single();

    // Check for assessment periods
    const { data: periods, error: periodsError } = await supabase
      .from("assessment_periods")
      .select("id, year, quarter, submitted_at, company_id")
      .eq("company_id", portalUser.company_id)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false })
      .limit(3);

    // Check for company-specific questions
    const { data: companyQuestions } = await supabase
      .from("questions")
      .select("id")
      .eq("company_id", portalUser.company_id)
      .limit(1);

    // Get questions (company-specific or standard)
    const questionsQuery = supabase
      .from("questions")
      .select("id, prompt, sequence, category_id")
      .order("sequence");

    if (companyQuestions && companyQuestions.length > 0) {
      questionsQuery.eq("company_id", portalUser.company_id);
    } else {
      questionsQuery.is("company_id", null);
    }

    const { data: questions } = await questionsQuery;

    // Get responses
    const periodIds = periods?.map(p => p.id) || [];
    const { data: responses } = await supabase
      .from("assessment_responses")
      .select("assessment_period_id, question_id, score")
      .in("assessment_period_id", periodIds);

    // Check question-response matching
    const questionIds = new Set(questions?.map(q => q.id) || []);
    const responseQuestionIds = new Set(responses?.map(r => r.question_id) || []);
    const matchingQuestionIds = [...questionIds].filter(id => responseQuestionIds.has(id));

    return NextResponse.json({
      user: {
        companyId: portalUser.company_id,
        companyName: companyInfo?.name,
      },
      periods: {
        found: periods?.length ?? 0,
        periods: periods?.map(p => ({
          id: p.id,
          year: p.year,
          quarter: p.quarter,
        })),
        error: periodsError?.message,
      },
      questions: {
        hasCompanySpecific: (companyQuestions?.length ?? 0) > 0,
        totalCount: questions?.length ?? 0,
        questionIds: questions?.map(q => q.id).slice(0, 10),
      },
      responses: {
        totalCount: responses?.length ?? 0,
        periodIds,
        responseQuestionIds: [...responseQuestionIds].slice(0, 10),
      },
      matching: {
        matchingCount: matchingQuestionIds.length,
        matchingQuestionIds: matchingQuestionIds.slice(0, 10),
        unmatchedQuestionIds: [...questionIds].filter(id => !responseQuestionIds.has(id)).slice(0, 10),
        unmatchedResponseQuestionIds: [...responseQuestionIds].filter(id => !questionIds.has(id)).slice(0, 10),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
