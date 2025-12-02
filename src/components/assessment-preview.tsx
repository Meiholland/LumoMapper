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
      "We have a clear and compelling value proposition that addresses our customers' most significant pains and needs",
    category: "Business Concept & Market",
    axis: "Value proposition",
    defaultScore: 3,
  },
  {
    id: "product-market-fit",
    prompt:
      "We continuously measure and evaluate to determine whether we have real product/market fit",
    category: "Business Concept & Market",
    axis: "Product leadership",
    defaultScore: 3,
  },
  {
    id: "market-leadership",
    prompt:
      "We are effectively gaining traction in our target market segments",
    category: "Business Concept & Market",
    axis: "Market leadership",
    defaultScore: 3,
  },
  {
    id: "customer-portfolio",
    prompt: "Our customer portfolio is extensive and we are not dependent on one single customer",
    category: "Customers, Sales & Branding",
    axis: "Customer portfolio",
    defaultScore: 3,
  },
  {
    id: "network",
    prompt: "We have established well functioning routines to maintain and strengthen our network",
    category: "Customers, Sales & Branding",
    axis: "Network",
    defaultScore: 3,
  },
  {
    id: "sales-motion",
    prompt: "We have a clear sales process with defined conversion metrics and predictable outcomes",
    category: "Customers, Sales & Branding",
    axis: "Sales",
    defaultScore: 3,
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
          Try it yourself
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          See how your answers shape your growth radar
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Adjust the sliders below to see how your responses translate into visual insights. 
          Each statement helps build a complete picture of where your company stands.
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
          <div key={category} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {category}
              </h3>
              <span className="text-xs font-medium text-slate-500">
                1 = Disagree • 5 = Strongly Agree
              </span>
            </div>
            <div className="space-y-4">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sun-300 hover:shadow-sm"
                >
                  <label className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                    <div className="flex-1 text-sm leading-relaxed text-slate-700">
                      {question.prompt}
                    </div>
                    <div className="flex items-center gap-4 md:w-64">
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
                        className="flex-1 accent-sun-500"
                      />
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sun-100 text-base font-bold text-sun-700 shadow-sm">
                        {scores[question.id]}
                      </span>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {groupedAverages.map((group) => (
          <RadarCard
            key={group.category}
            title={group.category}
            axes={group.axes}
          />
        ))}
      </section>
    </div>
  );
}

