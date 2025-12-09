import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { getOrCreatePortalUser } from "@/lib/supabase/portal-user";

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check company matching issues
 * Usage: /api/debug/company-match?email=user@example.com
 */
export async function GET(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const portalUser = await getOrCreatePortalUser(supabase, session);
    
    // Get user's company info
    const { data: userCompany } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", portalUser.company_id)
      .single();

    // Get all companies
    const { data: allCompanies } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");

    // Get all assessment periods with company info
    const { data: allPeriods } = await supabase
      .from("assessment_periods")
      .select("id, year, quarter, company_id, companies(name)")
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });

    // Count assessments by company
    const assessmentsByCompany = (allPeriods || []).reduce((acc, period) => {
      const companyId = period.company_id;
      const companyName = typeof period.companies === 'object' && period.companies && 'name' in period.companies
        ? (period.companies as { name: string }).name
        : 'Unknown';
      
      if (!acc[companyId]) {
        acc[companyId] = { id: companyId, name: companyName, count: 0, periods: [] };
      }
      acc[companyId].count++;
      acc[companyId].periods.push({
        id: period.id,
        year: period.year,
        quarter: period.quarter,
      });
      return acc;
    }, {} as Record<string, { id: string; name: string; count: number; periods: Array<{ id: string; year: number; quarter: number }> }>);

    return NextResponse.json({
      user: {
        id: portalUser.id,
        companyId: portalUser.company_id,
        companyName: userCompany?.name,
        email: session.user.email,
        metadata: session.user.user_metadata,
      },
      allCompanies: allCompanies || [],
      assessmentsByCompany: Object.values(assessmentsByCompany),
      userAssessments: Object.values(assessmentsByCompany).find(
        (c) => c.id === portalUser.company_id
      ) || { count: 0, periods: [] },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
