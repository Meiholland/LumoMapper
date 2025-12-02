"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { grantAdminRole, revokeAdminRole, getAllAdmins } from "./actions";

const grantSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type GrantFormValues = z.infer<typeof grantSchema>;

export default function AdminsPage() {
  const [status, setStatus] = useState<{
    type: "idle" | "error" | "success";
    message?: string;
  }>({ type: "idle" });
  const [admins, setAdmins] = useState<
    Array<{
      id: string;
      full_name: string;
      email: string;
      role: string;
      companies: { name: string } | null;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GrantFormValues>({
    resolver: zodResolver(grantSchema),
  });

  // Load admins on mount
  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    setIsLoading(true);
    const result = await getAllAdmins();
    if (result.error) {
      setStatus({ type: "error", message: result.error });
    } else {
      setAdmins(result.data ?? []);
    }
    setIsLoading(false);
  }

  const onGrantAdmin = handleSubmit((values) => {
    setStatus({ type: "idle" });
    startTransition(async () => {
      const result = await grantAdminRole(values.email);
      if (result.error) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStatus({
        type: "success",
        message: `Admin access granted to ${values.email}`,
      });
      reset();
      loadAdmins();
    });
  });

  const onRevokeAdmin = (email: string) => {
    if (!confirm(`Revoke admin access from ${email}?`)) {
      return;
    }
    startTransition(async () => {
      const result = await revokeAdminRole(email);
      if (result.error) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStatus({
        type: "success",
        message: `Admin access revoked from ${email}`,
      });
      loadAdmins();
    });
  };

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
          Manage Admins
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Add or remove admin users who can access the admin panel.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Grant Admin Section */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Grant Admin Access
          </h2>
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">Note:</p>
            <p className="mt-1">
              The user must already have signed up and created an account. This will grant admin access to their existing account. No email is sent.
            </p>
          </div>
          <form className="space-y-4" onSubmit={onGrantAdmin}>
            <label className="block text-sm font-medium text-slate-700">
              Email Address
              <input
                type="email"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-200"
                placeholder="user@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-rose-500">
                  {errors.email.message}
                </p>
              )}
            </label>

            {status.message && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  status.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-600"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {status.message}
              </div>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-3xl bg-gradient-to-r from-sun-400 to-sun-500 px-5 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sun-200/80 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? "Granting..." : "Grant Admin Access"}
            </button>
          </form>
        </div>

        {/* Current Admins Section */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Current Admins
          </h2>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : admins.length === 0 ? (
            <p className="text-sm text-slate-500">No admins found.</p>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-slate-900">{admin.full_name}</div>
                    <div className="text-sm text-slate-500">{admin.email}</div>
                    {admin.companies && (
                      <div className="text-xs text-slate-400">
                        {admin.companies.name}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onRevokeAdmin(admin.email)}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    disabled={isPending}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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

