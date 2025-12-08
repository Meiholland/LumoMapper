import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { getCompanyAssessment } from "./actions";
import { DashboardCharts } from "@/components/dashboard-charts";

export const dynamic = 'force-dynamic';

export default async function CompanyAssessmentPage({
  params,
}: {
  params: Promise<{ companyId: string; periodId: string }>;
}) {
  const { companyId, periodId } = await params;

  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/?message=Please%20log%20in%20to%20access%20the%20admin%20panel.");
  }

  const userIsAdmin = await isAdmin(supabase, session);
  if (!userIsAdmin) {
    redirect("/dashboard?message=You%20do%20not%20have%20admin%20access.");
  }

  const result = await getCompanyAssessment(companyId, periodId);

  if (result.error || !result.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-16">
        <header>
          <Link
            href="/admin/overview"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            ← Back to Overview
          </Link>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">
            Assessment Not Found
          </h1>
        </header>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
          <p className="text-rose-600">{result.error ?? "Assessment not found"}</p>
        </div>
      </div>
    );
  }

  const { assessment, companyName } = result.data;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-16">
      <header>
        <Link
          href="/admin/overview"
          className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          ← Back to Overview
        </Link>
        <h1 className="mt-4 text-4xl font-semibold text-slate-900">
          {companyName} - Q{assessment.assessment.quarter} {assessment.assessment.year}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Assessment submitted on{" "}
          {assessment.assessment.submitted_at
            ? new Date(assessment.assessment.submitted_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "Unknown date"}
        </p>
      </header>

      <DashboardCharts assessments={[assessment]} />

      <div className="mt-8 flex gap-3">
        <Link
          href="/admin/overview"
          className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-sun-300"
        >
          Back to Overview
        </Link>
        <Link
          href="/admin"
          className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-sun-300"
        >
          Back to Admin Panel
        </Link>
      </div>
    </div>
  );
}

