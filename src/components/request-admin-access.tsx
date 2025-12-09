"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

export function RequestAdminAccess() {
  const [status, setStatus] = useState<{ type: "idle" | "error" | "success"; message?: string }>({
    type: "idle",
  });
  const [isPending, startTransition] = useTransition();

  const handleRequestAccess = () => {
    setStatus({ type: "idle" });
    startTransition(() => {
      // For now, just show a message. In the future, this could send an email/notification
      setStatus({
        type: "success",
        message: "Admin access request submitted. You will be notified once access is granted.",
      });
    });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="w-full rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sun-100">
            <svg
              className="h-8 w-8 text-sun-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Admin Access Required
          </h1>
          <p className="mt-2 text-slate-600">
            As a Lumo Labs team member, you need admin access to view the admin panel.
          </p>
        </div>

        {status.message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              status.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {status.message}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleRequestAccess}
            disabled={isPending || status.type === "success"}
            className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sun-400 to-sun-500 px-5 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sun-200/80 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 disabled:opacity-60"
          >
            {isPending
              ? "Submitting..."
              : status.type === "success"
                ? "Request Submitted"
                : "Request Admin Access"}
          </button>

          <Link
            href="/"
            className="flex w-full items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-base font-semibold text-slate-600 transition hover:border-slate-300"
          >
            Back to Home
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Need immediate access? Contact your administrator or reach out to support.
        </p>
      </div>
    </div>
  );
}
