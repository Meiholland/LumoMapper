import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { getOrCreatePortalUser } from "@/lib/supabase/portal-user";
import { isAdmin } from "@/lib/supabase/admin";
import { RequestAdminAccess } from "@/components/request-admin-access";

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient();
  
  // Try both getSession and getUser to see which works
  const {
    data: { session: sessionData },
    error: sessionError,
  } = await supabase.auth.getSession();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Debug logging
  console.log("[AdminPage] Session check:", {
    hasSession: !!sessionData,
    sessionError: sessionError?.message,
    hasUser: !!user,
    userError: userError?.message,
    userId: sessionData?.user?.id || user?.id,
    email: sessionData?.user?.email || user?.email,
    metadataCompany: sessionData?.user?.user_metadata?.company_name || user?.user_metadata?.company_name,
  });

  // If we have a user but no session, we can still proceed
  // But getOrCreatePortalUser needs a session, so we need to handle this differently
  if (!sessionData && !user) {
    console.error("[AdminPage] No session or user found - redirecting to login");
    redirect("/?message=Please%20log%20in%20to%20access%20the%20admin%20panel.");
  }

  // Use sessionData if available, otherwise we'll need to work with user directly
  const session = sessionData;

  let portalUser;
  let companyName: string | null = null;
  
  try {
    // If we don't have a session but have a user, we need to create a minimal session
    // or fetch the portal user directly
    if (!session && user) {
      // Try to get portal user directly by auth_user_id
      const { data: portalUserData, error: portalError } = await supabase
        .from("users")
        .select("id, company_id, full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      
      if (portalUserData) {
        portalUser = portalUserData;
        console.log("[AdminPage] Got portal user directly:", portalUser);
      } else {
        throw new Error("Could not find portal user");
      }
    } else if (session) {
      portalUser = await getOrCreatePortalUser(supabase, session);
    }
    
    if (portalUser) {
      // Fetch company name
      if (portalUser.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", portalUser.company_id)
          .single();
        
        companyName = company?.name ?? null;
      }
    }
  } catch (error) {
    // If portal user creation fails, check if user metadata has company name
    // This can happen if the user just signed up but hasn't been created in the portal yet
    const metadataCompanyName = sessionData?.user?.user_metadata?.company_name || user?.user_metadata?.company_name;
    if (metadataCompanyName) {
      // Try to match case-insensitively
      const { data: companies } = await supabase
        .from("companies")
        .select("name")
        .ilike("name", metadataCompanyName.replace(/[%_]/g, '\\$&'))
        .limit(1);
      
      if (companies && companies.length > 0) {
        companyName = companies[0].name;
      }
    }
  }

  // Fallback: also check metadata if we still don't have company name
  if (!companyName) {
    const metadataCompanyName = sessionData?.user?.user_metadata?.company_name || user?.user_metadata?.company_name;
    if (metadataCompanyName) {
      const { data: companies } = await supabase
        .from("companies")
        .select("name")
        .ilike("name", metadataCompanyName.replace(/[%_]/g, '\\$&'))
        .limit(1);
      
      if (companies && companies.length > 0) {
        companyName = companies[0].name;
      }
    }
  }

  // For isAdmin check, we need a session - if we don't have one, assume not admin
  const userIsAdmin = session ? await isAdmin(supabase, session) : false;
  
  // Case-insensitive check for Lumo Labs (check both companyName and metadata)
  const metadataCompany = sessionData?.user?.user_metadata?.company_name || user?.user_metadata?.company_name;
  const isLumoLabs = 
    companyName?.toLowerCase() === "lumo labs" ||
    metadataCompany?.toLowerCase() === "lumo labs";


  // If user is from Lumo Labs but not an admin, show request access page
  if (isLumoLabs && !userIsAdmin) {
    return <RequestAdminAccess />;
  }

  // If user is not from Lumo Labs and not an admin, redirect to dashboard
  if (!isLumoLabs && !userIsAdmin) {
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

