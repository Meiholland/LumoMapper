"use client";

import { useState, useEffect } from "react";
import { generateQuarterlyReview } from "@/app/admin/overview/[companyId]/review/actions";
import { QuarterlyReviewDisplay } from "./quarterly-review-display";
import { LoadingModal } from "./loading-modal";
import type { QuarterlyReview } from "@/app/admin/overview/[companyId]/review/actions";

type Props = {
  companyId: string;
  companyName: string;
  year: number;
  quarter: number;
};

export function QuarterlyReviewWrapper({
  companyId,
  companyName,
  year,
  quarter,
}: Props) {
  const [review, setReview] = useState<QuarterlyReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReview() {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await generateQuarterlyReview(
          companyId,
          companyName,
          year,
          quarter,
        );

        if (result.error) {
          setError(result.error);
        } else {
          setReview(result.data!);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate review",
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadReview();
  }, [companyId, companyName, year, quarter]);

  if (isLoading) {
    return <LoadingModal isOpen={true} />;
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-rose-600">Error: {error}</p>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-slate-600">No review data available.</p>
      </div>
    );
  }

  return <QuarterlyReviewDisplay review={review} />;
}

