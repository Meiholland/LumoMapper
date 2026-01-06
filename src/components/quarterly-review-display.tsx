"use client";

import type { QuarterlyReviewInsight } from "@/app/admin/overview/[companyId]/review/actions";

type QuarterlyReview = {
  executive_summary: string;
  insights: QuarterlyReviewInsight[];
  recommendations: string[];
};

type Props = {
  review: QuarterlyReview;
};

export function QuarterlyReviewDisplay({ review }: Props) {
  const getInsightColor = (type: string) => {
    switch (type) {
      case "improvement":
        return "border-emerald-200 bg-emerald-50";
      case "decline":
        return "border-rose-200 bg-rose-50";
      case "shift":
        return "border-blue-200 bg-blue-50";
      case "correlation":
        return "border-amber-200 bg-amber-50";
      default:
        return "border-slate-200 bg-slate-50";
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "improvement":
        return "📈";
      case "decline":
        return "📉";
      case "shift":
        return "🔄";
      case "correlation":
        return "🔗";
      default:
        return "💡";
    }
  };

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-lg">
        <h2 className="mb-4 text-2xl font-semibold text-slate-900">
          Executive Summary
        </h2>
        <p className="text-lg leading-relaxed text-slate-700">
          {review.executive_summary}
        </p>
      </section>

      {/* Key Insights */}
      {review.insights.length > 0 && (
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-slate-900">
            Key Insights
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {review.insights.map((insight, index) => (
              <div
                key={index}
                className={`rounded-2xl border p-6 ${getInsightColor(insight.type)}`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-2xl">{getInsightIcon(insight.type)}</span>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {insight.title}
                  </h3>
                </div>
                <p className="mb-4 text-sm text-slate-700">
                  {insight.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span>
                    <span className="font-medium">{insight.pillar}</span> →{" "}
                    {insight.category}
                  </span>
                  {insight.change !== 0 && (
                    <span
                      className={`font-semibold ${
                        insight.change > 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {insight.change > 0 ? "+" : ""}
                      {insight.change.toFixed(1)} points
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {review.recommendations.length > 0 && (
        <section className="rounded-3xl border border-sun-200 bg-gradient-to-br from-sun-50 to-white p-8 shadow-lg">
          <h2 className="mb-6 text-2xl font-semibold text-slate-900">
            Recommendations
          </h2>
          <ul className="space-y-3">
            {review.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sun-200 text-sm font-semibold text-sun-800">
                  {index + 1}
                </span>
                <p className="text-slate-700">{rec}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

