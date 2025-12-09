"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { grantAdminRoleByAuthId, revokeAdminRoleByAuthId, getAllUsers } from "./actions";

type User = {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: string;
  companies: { name: string } | null;
  admin_requested_at: string | null;
};

export default function AdminsPage() {
  const [status, setStatus] = useState<{
    type: "idle" | "error" | "success";
    message?: string;
  }>({ type: "idle" });
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Load all users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    setStatus({ type: "idle" });
    const result = await getAllUsers();
    if (result.error) {
      setStatus({ type: "error", message: result.error });
    } else {
      setUsers(result.data ?? []);
    }
    setIsLoading(false);
  }

  const onGrantAdmin = (authUserId: string, email: string) => {
    if (!confirm(`Grant admin access to ${email}?`)) {
      return;
    }
    setStatus({ type: "idle" });
    startTransition(async () => {
      const result = await grantAdminRoleByAuthId(authUserId);
      if (result.error) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStatus({
        type: "success",
        message: `Admin access granted to ${email}`,
      });
      loadUsers();
    });
  };

  const onRevokeAdmin = (authUserId: string, email: string) => {
    if (!confirm(`Revoke admin access from ${email}?`)) {
      return;
    }
    setStatus({ type: "idle" });
    startTransition(async () => {
      const result = await revokeAdminRoleByAuthId(authUserId);
      if (result.error) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStatus({
        type: "success",
        message: `Admin access revoked from ${email}`,
      });
      loadUsers();
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

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          All Users
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          Manage admin access for all registered users. Click "Make Admin" or "Revoke" to change their role.
        </p>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500">No users found.</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-slate-900">{user.full_name}</div>
                    {user.role === "admin" && (
                      <span className="rounded-full bg-sun-100 px-2 py-0.5 text-xs font-medium text-sun-700">
                        Admin
                      </span>
                    )}
                    {user.admin_requested_at && user.role !== "admin" && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Requested
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{user.email}</div>
                  {user.companies && (
                    <div className="mt-1 text-xs text-slate-400">
                      {user.companies.name}
                    </div>
                  )}
                  {user.admin_requested_at && user.role !== "admin" && (
                    <div className="mt-1 text-xs text-blue-600">
                      Requested {new Date(user.admin_requested_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="ml-4">
                  {user.role === "admin" ? (
                    <button
                      onClick={() => onRevokeAdmin(user.auth_user_id, user.email)}
                      className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      disabled={isPending}
                    >
                      {isPending ? "Revoking..." : "Revoke"}
                    </button>
                  ) : (
                    <button
                      onClick={() => onGrantAdmin(user.auth_user_id, user.email)}
                      className="rounded-lg border border-sun-300 bg-sun-50 px-4 py-2 text-sm font-medium text-sun-700 transition hover:bg-sun-100 disabled:opacity-50"
                      disabled={isPending}
                    >
                      {isPending ? "Granting..." : "Make Admin"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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

