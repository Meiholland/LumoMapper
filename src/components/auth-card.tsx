"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { portfolioCompanies } from "@/data/companies";
import { useRouter } from "next/navigation";

const sharedFields = {
  email: z.string().email("Use a valid email address"),
  password: z.string().min(8, "At least 8 characters"),
};

const signupSchema = z
  .object({
    mode: z.literal("signup"),
    fullName: z.string().min(3, "Tell us your name"),
    companyName: z.enum(portfolioCompanies, {
      message: "Pick your company",
    }),
    ...sharedFields,
  })
  .strict();

const loginSchema = z
  .object({
    mode: z.literal("login"),
    ...sharedFields,
  })
  .strict();

const schema = z.discriminatedUnion("mode", [signupSchema, loginSchema]);

type FormValues = z.infer<typeof schema>;

export function AuthCard() {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [showSignupSuccessModal, setShowSignupSuccessModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentMode, setCurrentMode] =
    useState<FormValues["mode"]>("signup");
  const router = useRouter();

  // Ensure component is mounted before rendering portal (prevents hydration issues)
  useEffect(() => {
    setMounted(true);
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    getValues,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    shouldUnregister: true,
    defaultValues: {
      mode: "signup",
      email: "",
      password: "",
      fullName: "",
      companyName: portfolioCompanies[0],
    } as FormValues,
  });

  const supabase = useMemo(() => {
    // console.info("[AuthCard] Creating supabase browser client");
    return getSupabaseBrowserClient();
  }, []);

  useEffect(() => {
    // console.info("[AuthCard] Current mode changed:", currentMode);
  }, [currentMode]);

  useEffect(() => {
    setValue("mode", currentMode, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [currentMode, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    // console.debug("[AuthCard] onSubmit payload", values);
    setServerMessage(null);

    if (values.mode === "login") {
      try {
        setServerMessage("Authenticating...");
        // console.info("[AuthCard] Calling signInWithPassword");
        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        // console.info("[AuthCard] signInWithPassword response:", {
        //   data,
        //   error,
        // });

        if (error) {
          setServerMessage(error.message);
          // console.warn("[AuthCard] Supabase login error shown to user");
          return;
        }

        // Check if user is admin and redirect accordingly
        setServerMessage("Authenticating...");
        // console.info("[AuthCard] Checking admin status and redirecting");
        
        // Fetch user role and company name to determine redirect and show company
        const { data: userData } = await supabase
          .from("users")
          .select("role, company_id, companies(name)")
          .eq("auth_user_id", data.user.id)
          .limit(1)
          .maybeSingle();

        // Extract company name from Supabase relation (can be object or array)
        let companyName: string | null = null;
        if (userData?.companies) {
          if (Array.isArray(userData.companies) && userData.companies.length > 0) {
            companyName = userData.companies[0]?.name ?? null;
          } else if (typeof userData.companies === 'object' && 'name' in userData.companies) {
            companyName = (userData.companies as { name: string }).name;
          }
        }

        // Fallback: fetch company separately if relation didn't work
        if (!companyName && userData?.company_id) {
          const { data: companyData } = await supabase
            .from("companies")
            .select("name")
            .eq("id", userData.company_id)
            .single();
          companyName = companyData?.name ?? null;
        }

        // Special handling: Lumo Labs users always go to admin page
        let redirectPath = "/dashboard";
        if (companyName === "Lumo Labs") {
          redirectPath = "/admin";
        } else if (userData?.role === "admin") {
          redirectPath = "/admin";
        }
        
        // Show success message with company name
        if (companyName) {
          setServerMessage(`Logged in as ${companyName}! Redirecting...`);
        } else {
          setServerMessage("Logged in! Redirecting...");
        }
        
        // Small delay to show the message and ensure cookies are set
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Use window.location for hard navigation to ensure cookies are synced
        // This forces a full page reload which ensures server-side cookies are read correctly
        window.location.href = redirectPath;
      } catch (loginError) {
        // console.error("[AuthCard] Unexpected login exception", loginError);
        setServerMessage("Something went wrong. Check the console for details.");
      }
      return;
    }

    // Lumo Labs users should be redirected to admin page after email confirmation
    const nextPath = values.companyName === "Lumo Labs" ? "/admin" : "/dashboard";
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${nextPath}`
        : undefined;

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: values.fullName,
          company_name: values.companyName,
        },
      },
    });

    if (error) {
      // console.error("Supabase sign-up error:", error);
      setServerMessage(error.message);
      return;
    }

    // Supabase signUp returns data.user even when email confirmation is enabled
    // The user will have email_confirmed_at: null until they click the confirmation link
    // If emails aren't being sent, check Supabase Auth settings:
    // 1. Go to Authentication > Providers > Email
    // 2. Ensure "Confirm email" is enabled
    // 3. Check "Redirect URLs" includes your domain
    // 4. For production, configure custom SMTP (default has low rate limits)

    // Show success modal
    setShowSignupSuccessModal(true);
    setValue("mode", "login");
    setCurrentMode("login");
    setValue("password", "");
  });

  const handleModeChange = (nextMode: FormValues["mode"]) => {
    setServerMessage(null);
    setCurrentMode(nextMode);
    // console.debug(
    //   "[AuthCard] Mode switched to",
    //   nextMode,
    //   "current form values",
    //   getValues(),
    // );
  };

  return (
    <div className="rounded-3xl bg-white/90 p-8 shadow-xl shadow-sun-200/50 ring-1 ring-sun-100 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            VC Progress Portal
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            {currentMode === "signup" ? "Create an account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentMode === "signup"
              ? "Onboard your company in minutes."
              : "Log in to review your assessments."}
          </p>
        </div>
        <div className="flex gap-2 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${currentMode === "login" ? "bg-white text-slate-900 shadow" : ""}`}
            onClick={() => handleModeChange("login")}
            disabled={isSubmitting}
          >
            Login
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${currentMode === "signup" ? "bg-white text-slate-900 shadow" : ""}`}
            onClick={() => handleModeChange("signup")}
            disabled={isSubmitting}
          >
            Sign up
          </button>
        </div>
      </div>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <input type="hidden" {...register("mode")} />
        {currentMode === "signup" && (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Full name
              <input
                type="text"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-200"
                placeholder="E.g. Robin Venture"
                {...register("fullName")}
              />
              <FieldError message={(errors as any).fullName?.message} />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Company
              <select
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-200"
                {...register("companyName")}
              >
                {portfolioCompanies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
              <FieldError message={(errors as any).companyName?.message} />
            </label>
          </>
        )}

        <label className="block text-sm font-medium text-slate-700">
          Work email
          <input
            type="email"
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-200"
            placeholder="you@company.com"
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-200"
            placeholder="••••••••"
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </label>

        {serverMessage && (
          <p className="text-sm text-slate-500">{serverMessage}</p>
        )}

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sun-400 to-sun-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Hold on..."
            : currentMode === "signup"
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      {/* Signup Success Modal - Rendered via portal to cover entire page */}
      {mounted && showSignupSuccessModal && createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              margin: 0,
              padding: '1rem',
              zIndex: 9999,
              overflow: 'auto',
            }}
            onClick={(e) => {
              // Close modal when clicking backdrop
              if (e.target === e.currentTarget) {
                setShowSignupSuccessModal(false);
              }
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <svg
                    className="h-6 w-6 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Check your inbox
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    We've sent a confirmation email to your address. Once you verify your account, you can log in.
                  </p>
                  <p className="mt-3 text-xs font-medium text-slate-500">
                    💡 Tip: Use the same browser when clicking the confirmation link
                  </p>
                </div>
                <button
                  onClick={() => setShowSignupSuccessModal(false)}
                  className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setShowSignupSuccessModal(false)}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-sun-400 to-sun-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Got it
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-rose-500">{message}</p>;
}

