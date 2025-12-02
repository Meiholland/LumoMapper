"use client";

import { useMemo, useState } from "react";
import { RadarCard } from "@/components/radar-card";

type Question = {
  id: string;
  prompt: string;
  category: string;
  axis: string;
  defaultScore: number;
};

const questionBank: Question[] = [
  {
    id: "value-proposition",
    prompt:
      "We have a clearly defined value proposition grounded in validated customer insight.",
    category: "Business Concept & Market",
    axis: "Value proposition",
    defaultScore: 3,
  },
  {
    id: "market-leadership",
    prompt:
      "We track competitors and understand our path to market leadership.",
    category: "Business Concept & Market",
    axis: "Market leadership",
    defaultScore: 2,
  },
  {
    id: "customer-portfolio",
    prompt: "Our customer portfolio is diversified and expanding.",
    category: "Business Concept & Market",
    axis: "Customer portfolio",
    defaultScore: 4,
  },
  {
    id: "sales-motion",
    prompt: "Our sales process is structured with clear conversion metrics.",
    category: "Customers, Sales & Branding",
    axis: "Sales",
    defaultScore: 3,
  },
  {
    id: "network",
    prompt: "We leverage a strong ecosystem/network to drive growth.",
    category: "Customers, Sales & Branding",
    axis: "Network",
    defaultScore: 2,
  },
  {
    id: "financial-management",
    prompt: "We have a rolling 18-month financial plan and scenario model.",
    category: "Admin, Tech & Finance",
    axis: "Financial management",
    defaultScore: 2,
  },
  {
    id: "core-tech",
    prompt:
      "Our core technology roadmap is documented with measurable milestones.",
    category: "Admin, Tech & Finance",
    axis: "Core technology",
    defaultScore: 5,
  },
  {
    id: "team",
    prompt: "Leadership and team rituals foster high accountability.",
    category: "Organization & Leadership",
    axis: "Team",
    defaultScore: 3,
  },
  {
    id: "legal",
    prompt: "Company has a clean legal & ownership structure.",
    category: "Organization & Leadership",
    axis: "Legal",
    defaultScore: 4,
  },
];

export function AssessmentPreview() {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(
      questionBank.map((question) => [question.id, question.defaultScore]),
    ),
  );

  const groupedAverages = useMemo(() => {
    const result = new Map<string, { [axis: string]: number[] }>();
    questionBank.forEach((question) => {
      const category = result.get(question.category) ?? {};
      const axisScores = category[question.axis] ?? [];
      axisScores.push(scores[question.id]);
      category[question.axis] = axisScores;
      result.set(question.category, category);
    });

    return Array.from(result.entries()).map(([category, axes]) => ({
      category,
      axes: Object.entries(axes).map(([axis, axisScores]) => ({
        label: axis,
        score:
          axisScores.reduce((total, score) => total + score, 0) /
          axisScores.length,
      })),
    }));
  }, [scores]);

  return (
    <div className="space-y-8 rounded-3xl bg-white/70 p-8 shadow-xl ring-1 ring-slate-100 backdrop-blur">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
          Sample assessment
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Adjust the statements to see the radar update
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          This is a live preview of how founders will experience the portal.
        </p>
      </header>

      <section className="space-y-6">
        {Object.entries(
          questionBank.reduce<Record<string, Question[]>>((acc, question) => {
            acc[question.category] = acc[question.category] ?? [];
            acc[question.category].push(question);
            return acc;
          }, {}),
        ).map(([category, questions]) => (
          <div key={category} className="rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {category}
              </h3>
              <span className="text-xs uppercase tracking-widest text-slate-500">
                1 (disagree) → 5 (strongly agree)
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {questions.map((question) => (
                <label
                  key={question.id}
                  className="flex flex-col gap-3 rounded-xl bg-slate-50/60 p-4 md:flex-row md:items-center md:gap-6"
                >
                  <div className="flex-1 text-sm text-slate-700">
                    {question.prompt}
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={scores[question.id]}
                    onChange={(event) =>
                      setScores((prev) => ({
                        ...prev,
                        [question.id]: Number(event.target.value),
                      }))
                    }
                    className="w-full accent-sun-500 md:w-48"
                  />
                  <span className="w-10 text-right text-lg font-semibold text-slate-900">
                    {scores[question.id]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {groupedAverages.map((group) => (
          <RadarCard
            key={group.category}
            subtitle="Category health"
            title={group.category}
            axes={group.axes}
          />
        ))}
      </section>
    </div>
  );
}

