import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { getCompanyOverview } from "./actions";
import { AdminAssessmentCard } from "@/components/admin-assessment-card";

export default async function OverviewPage() {
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

  const overviewResult = await getCompanyOverview();
  const { withAssessments = [], withoutAssessments = [] } = overviewResult.data ?? {};

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-16">
      <header>
        <Link
          href="/admin"
          className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          ← Back to Admin Panel
        </Link>
        <h1 className="mt-4 text-4xl font-semibold text-slate-900">
          Company Overview
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          View which teams have completed assessments for which quarters.
        </p>
      </header>

      {/* Companies with assessments */}
      {withAssessments.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 text-center">
          <p className="text-slate-600">No companies have submitted assessments yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {withAssessments.map((company) => (
            <div
              key={company.id}
              className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  {company.name}
                </h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  {company.assessments.length} assessment{company.assessments.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                <Link
                  href={`/admin/overview/${company.id}/all`}
                  className="group rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-sun-400 hover:bg-sun-50 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700 group-hover:text-sun-700">
                      View All
                    </div>
                    <svg
                      className="h-4 w-4 text-slate-400 transition group-hover:text-sun-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 group-hover:text-slate-600">
                    Last {Math.min(company.assessments.length, 3)} quarter{Math.min(company.assessments.length, 3) !== 1 ? "s" : ""}
                  </div>
                </Link>
                {company.assessments.map((assessment) => (
                  <AdminAssessmentCard
                    key={assessment.id}
                    companyId={company.id}
                    assessment={assessment}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Companies without assessments */}
      {withoutAssessments.length > 0 && (
        <div className="mt-12 space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Companies Without Assessments
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The following companies have not yet submitted any assessments.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {withoutAssessments.map((company) => (
              <div
                key={company.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="text-sm font-semibold text-slate-700">
                  {company.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  No assessments
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-sun-300"
        >
          Back to Admin Panel
        </Link>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
          >
            Log Out
          </button>
        </form>
      </div>
    </div>
  );
}

