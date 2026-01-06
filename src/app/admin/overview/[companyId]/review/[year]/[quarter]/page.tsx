import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { QuarterlyReviewWrapper } from "@/components/quarterly-review-wrapper";

export const dynamic = "force-dynamic";

export default async function QuarterlyReviewPage({
  params,
}: {
  params: Promise<{ companyId: string; year: string; quarter: string }>;
}) {
  const { companyId, year, quarter } = await params;
  const yearNum = parseInt(year, 10);
  const quarterNum = parseInt(quarter, 10);

  if (isNaN(yearNum) || isNaN(quarterNum) || quarterNum < 1 || quarterNum > 4) {
    redirect("/admin/overview");
  }

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

  // Get company name
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();

  if (!company) {
    redirect("/admin/overview");
  }

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
          Quarterly Review - {company.name}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Q{quarterNum} {yearNum} Analysis
        </p>
      </header>

      <QuarterlyReviewWrapper
        companyId={companyId}
        companyName={company.name}
        year={yearNum}
        quarter={quarterNum}
      />

      <div className="mt-8 flex gap-3">
        <Link
          href="/admin/overview"
          className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-sun-300"
        >
          Back to Overview
        </Link>
        <Link
          href={`/admin/overview/${companyId}/all`}
          className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-sun-300"
        >
          Back to Company Overview
        </Link>
      </div>
    </div>
  );
}

