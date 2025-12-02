"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [currentMode, setCurrentMode] =
    useState<FormValues["mode"]>("signup");
  const router = useRouter();
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
        setServerMessage("Logged in! Redirecting...");
        // console.info("[AuthCard] Checking admin status and redirecting");
        
        // Fetch user role to determine redirect
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("auth_user_id", data.user.id)
          .limit(1)
          .maybeSingle();

        const redirectPath = userData?.role === "admin" ? "/admin" : "/dashboard";
        // console.info("[AuthCard] Navigating to", redirectPath);
        await router.push(redirectPath);
        router.refresh();
      } catch (loginError) {
        // console.error("[AuthCard] Unexpected login exception", loginError);
        setServerMessage("Something went wrong. Check the console for details.");
      }
      return;
    }

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=/dashboard`
        : undefined;

    const { error } = await supabase.auth.signUp({
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

    setServerMessage(
      "Check your inbox to confirm your account. Once verified you can log in.",
    );
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
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-rose-500">{message}</p>;
}

