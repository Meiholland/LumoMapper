"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteAssessment } from "@/app/admin/overview/actions";

type AssessmentCardProps = {
  companyId: string;
  assessment: {
    id: string;
    year: number;
    quarter: number;
    submitted_at: string | null;
  };
};

export function AdminAssessmentCard({ companyId, assessment }: AssessmentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Delete assessment Q${assessment.quarter} ${assessment.year}? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    startTransition(async () => {
      const result = await deleteAssessment(assessment.id);
      if (result.error) {
        alert(`Failed to delete assessment: ${result.error}`);
        setIsDeleting(false);
      } else {
        // Refresh the page to show updated list
        window.location.reload();
      }
    });
  };

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-sun-400 hover:bg-sun-50 hover:shadow-sm">
      <Link
        href={`/admin/overview/${companyId}/${assessment.id}`}
        className="block"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 group-hover:text-sun-700">
            Q{assessment.quarter} {assessment.year}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete(e);
              }}
              disabled={isPending || isDeleting}
              className="rounded p-1 text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50"
              title="Delete assessment"
            >
              {isPending || isDeleting ? (
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
            </button>
            <svg
              className="h-4 w-4 text-slate-400 transition group-hover:text-sun-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
        <div className="mt-1 text-xs text-slate-500 group-hover:text-slate-600">
          {assessment.submitted_at
            ? new Date(assessment.submitted_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Unknown date"}
        </div>
      </Link>
    </div>
  );
}

