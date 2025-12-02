import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { getCompanyAllAssessments } from "./actions";
import { DashboardCharts } from "@/components/dashboard-charts";

export default async function CompanyAllAssessmentsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

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

  const result = await getCompanyAllAssessments(companyId);

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
            Assessments Not Found
          </h1>
        </header>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
          <p className="text-rose-600">{result.error ?? "Assessments not found"}</p>
        </div>
      </div>
    );
  }

  const { companyName, assessments } = result.data;

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
          {companyName} - All Assessments
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Comparing the last {Math.min(assessments.length, 3)} quarter{Math.min(assessments.length, 3) !== 1 ? "s" : ""} of assessments
        </p>
      </header>

      {assessments.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-center">
          <p className="text-slate-600">No assessments found for this company.</p>
        </div>
      ) : (
        <DashboardCharts assessments={assessments} />
      )}

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

