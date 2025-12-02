import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";

export default async function AdminPage() {
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

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-16">
      <header>
        <p className="text-sm uppercase tracking-[0.4em] text-slate-500">
          Admin Panel
        </p>
        <h1 className="mt-2 text-4xl font-semibold text-slate-900">
          Portfolio Management
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage assessments, view company progress, and administer user access.
        </p>
      </header>

      <nav className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/import"
          className="group relative flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:border-sun-300 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sun-100 text-sun-600 transition group-hover:bg-sun-200">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Import Data
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Import historical assessment data from JSON for portfolio companies.
          </p>
        </Link>

        <Link
          href="/admin/overview"
          className="group relative flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:border-sun-300 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 transition group-hover:bg-blue-200">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Company Overview
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            View which teams have completed assessments for which quarters.
          </p>
        </Link>

        <Link
          href="/admin/admins"
          className="group relative flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:border-sun-300 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 transition group-hover:bg-purple-200">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Manage Admins
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Add or remove admin users who can access this panel.
          </p>
        </Link>
      </nav>

      <div className="mt-8 flex gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-sun-300"
        >
          Back to Dashboard
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

