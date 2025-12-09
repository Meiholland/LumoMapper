"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { validateUUID } from "@/lib/validation";

export type CompanyOverview = {
  id: string;
  name: string;
  assessments: Array<{
    id: string;
    year: number;
    quarter: number;
    submitted_at: string | null;
  }>;
};

export async function getCompanyOverview() {
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
    // Fetch all companies
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");

    if (companiesError || !companies) {
      return { error: "Failed to load companies" };
    }

    // Fetch all assessment periods
    const { data: assessments, error: assessmentsError } = await supabase
      .from("assessment_periods")
      .select("id, company_id, year, quarter, submitted_at")
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });

    if (assessmentsError) {
      return { error: "Failed to load assessments" };
    }

    // Group assessments by company
    const companyMap = new Map<string, CompanyOverview>();

    for (const company of companies) {
      companyMap.set(company.id, {
        id: company.id,
        name: company.name,
        assessments: [],
      });
    }

    for (const assessment of assessments || []) {
      const company = companyMap.get(assessment.company_id);
      if (company) {
        company.assessments.push({
          id: assessment.id,
          year: assessment.year,
          quarter: assessment.quarter,
          submitted_at: assessment.submitted_at,
        });
      }
    }

    // Separate companies with assessments from those without
    const companiesWithAssessments = Array.from(companyMap.values())
      .filter((company) => company.assessments.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const companiesWithoutAssessments = Array.from(companyMap.values())
      .filter((company) => company.assessments.length === 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      data: {
        withAssessments: companiesWithAssessments,
        withoutAssessments: companiesWithoutAssessments,
      },
    };
  } catch (error) {
    // console.error("Failed to fetch company overview:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to load overview",
    };
  }
}

/**
 * Delete an assessment period (cascades to responses)
 */
export async function deleteAssessment(assessmentId: string) {
  // Validate UUID
  const assessmentIdValidation = validateUUID(assessmentId, "assessment ID");
  if (assessmentIdValidation.error) {
    return { error: assessmentIdValidation.error };
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
    const { error: deleteError } = await supabase
      .from("assessment_periods")
      .delete()
      .eq("id", assessmentId);

    if (deleteError) {
      return { error: deleteError.message };
    }

    return { success: true };
  } catch (error) {
    // console.error("Failed to delete assessment:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete assessment",
    };
  }
}

