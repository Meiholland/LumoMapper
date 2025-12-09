"use client";

import { RadarCard } from "./radar-card";
import type { AssessmentWithScores } from "@/app/dashboard/actions";

type Props = {
  assessments: AssessmentWithScores[];
};

export function DashboardCharts({ assessments }: Props) {
  if (assessments.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-lg shadow-sun-100/40">
        <p className="text-sm text-slate-600">
          No assessments yet. Start your first quarterly assessment to see radar
          charts here.
        </p>
      </section>
    );
  }

  // If only one assessment, still show it (for admin view)
  if (assessments.length === 1) {
    const assessment = assessments[0];
    const pillarCategoryMap = new Map<string, string[]>();
    
    for (const category of assessment.categories) {
      if (!pillarCategoryMap.has(category.pillar)) {
        pillarCategoryMap.set(category.pillar, []);
      }
      pillarCategoryMap.get(category.pillar)!.push(category.categoryLabel);
    }

    const charts = Array.from(pillarCategoryMap.entries()).map(([pillar, categoryLabels]) => {
      const assessmentCategories = assessment.categories.filter(
        (c) => c.pillar === pillar,
      );

      const axes = categoryLabels.map((label) => {
        const category = assessmentCategories.find(
          (c) => c.categoryLabel === label,
        );
        const score = category?.axes[0]?.score ?? 0;
        return {
          label,
          score,
        };
      });

      return {
        pillar,
        datasets: [
          {
            label: `Q${assessment.assessment.quarter} ${assessment.assessment.year}`,
            axes,
          },
        ],
      };
    });

    return (
      <section className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {charts.map(({ pillar, datasets }) => (
            <RadarCard
              key={pillar}
              title={pillar}
              datasets={datasets}
            />
          ))}
        </div>
      </section>
    );
  }

  // Group categories by pillar to match the original 4 radar charts
  // Get all unique category labels per pillar from the latest assessment
  const latest = assessments[0];
  const pillarCategoryMap = new Map<string, string[]>();
  
  for (const category of latest.categories) {
    if (!pillarCategoryMap.has(category.pillar)) {
      pillarCategoryMap.set(category.pillar, []);
    }
    pillarCategoryMap.get(category.pillar)!.push(category.categoryLabel);
  }

  // Build datasets for each pillar
  const charts = Array.from(pillarCategoryMap.entries()).map(([pillar, categoryLabels]) => {
    // Build datasets for each assessment
    const datasets = assessments.map((assessment) => {
      // Find this pillar's categories in this assessment
      const assessmentCategories = assessment.categories.filter(
        (c) => c.pillar === pillar,
      );

      // Build axis scores - each category label is an axis
      const axes = categoryLabels.map((label) => {
        const category = assessmentCategories.find(
          (c) => c.categoryLabel === label,
        );
        // Each category has one axis with its average score
        const score = category?.axes[0]?.score ?? 0;
        return {
          label,
          score,
        };
      });

      return {
        label: `Q${assessment.assessment.quarter} ${assessment.assessment.year}`,
        axes,
      };
    });

    return { pillar, datasets };
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Quarterly Progress
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Comparing your last {assessments.length} quarter
          {assessments.length !== 1 ? "s" : ""} of assessments
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {charts.map(({ pillar, datasets }) => (
          <RadarCard
            key={pillar}
            title={pillar}
            datasets={datasets}
          />
        ))}
      </div>
    </section>
  );
}

