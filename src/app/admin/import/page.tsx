import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";
import { AdminImportForm } from "@/components/admin-import-form";

export default async function ImportPage() {
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
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-16">
      <header>
        <Link
          href="/admin"
          className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          ← Back to Admin Panel
        </Link>
        <p className="mt-4 text-sm uppercase tracking-[0.4em] text-slate-500">
          Admin Import Tool
        </p>
        <h1 className="mt-2 text-4xl font-semibold text-slate-900">
          Import Historical Assessment
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Paste JSON assessment data to import a completed assessment for a
          company and quarter.
        </p>
      </header>

      <AdminImportForm />

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
