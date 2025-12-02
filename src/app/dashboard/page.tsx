import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { getLatestAssessments } from "./actions";
import { DashboardCharts } from "@/components/dashboard-charts";

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    // console.error("Supabase getSession error:", error);
  }

  if (!session) {
    redirect("/?message=Please%20log%20in%20to%20access%20your%20dashboard.");
  }

  const {
    user: { email, user_metadata },
  } = session;

  const assessmentsResult = await getLatestAssessments(3);
  const assessments = assessmentsResult.data ?? [];

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-16">
      <header>
        <p className="text-sm uppercase tracking-[0.4em] text-slate-500">
          Portfolio dashboard
        </p>
        <h1 className="mt-2 text-4xl font-semibold text-slate-900">
          Welcome back{user_metadata?.full_name ? `, ${user_metadata.full_name}` : ""}.
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          You are logged in as {email}. Review your quarterly progress below.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/assessments/new"
            className="inline-flex items-center rounded-full bg-gradient-to-r from-sun-400 to-sun-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow shadow-sun-200/70 transition hover:brightness-110"
          >
            Start assessment
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-sun-300"
          >
            Back to landing
          </Link>
        </div>
      </header>

      <DashboardCharts assessments={assessments} />
    </div>
  );
}

