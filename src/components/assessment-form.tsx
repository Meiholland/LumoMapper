"use client";

import { useMemo, useState, useTransition, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitAssessment, getPreviousAssessmentScores } from "@/app/assessments/actions";

const schema = z.object({
  year: z.number().min(2015).max(2100),
  quarter: z.number().int().min(1).max(4),
  answers: z.record(z.string(), z.number().int().min(1).max(5)),
});

type FormValues = z.infer<typeof schema>;

type Question = {
  id: string;
  prompt: string;
};

type Category = {
  id: string;
  pillar: string;
  label: string;
  questions: Question[];
};

type Props = {
  categories: Category[];
};

// Separate component for the slider to ensure re-renders
const QuestionSlider = memo(function QuestionSlider({
  questionId,
  currentValue,
  previousValue,
  initialValue,
  onChange,
}: {
  questionId: string;
  currentValue: number;
  previousValue: number | undefined;
  initialValue: number;
  onChange: (value: number) => void;
}) {
  // Use previousValue if available, otherwise use initialValue (default 3)
  const comparisonValue = previousValue !== undefined && previousValue !== null 
    ? previousValue 
    : initialValue;
  const difference = currentValue - comparisonValue;
  const isIncrease = difference > 0;
  const isDecrease = difference < 0;
  const showIndicator = difference !== 0;

  return (
    <div className="mt-5 space-y-2">
      <div className="relative">
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={currentValue}
          onChange={(event) => onChange(Number(event.target.value))}
          onInput={(event) => onChange(Number((event.target as HTMLInputElement).value))}
          className="w-full transition-colors"
          style={{
            accentColor: isIncrease
              ? "rgb(16 185 129)" // emerald-500
              : isDecrease
                ? "rgb(244 63 94)" // rose-500
                : "rgb(251 191 36)", // sun-500 (amber-400)
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
        <span>Disagree</span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2 py-0.5 text-sm font-semibold text-slate-900">
            {currentValue}
          </span>
          {showIndicator && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
                isIncrease
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {difference > 0 ? "+" : ""}
              {difference}
            </span>
          )}
        </div>
        <span>Strongly agree</span>
      </div>
    </div>
  );
});

function getDefaultYear() {
  return new Date().getFullYear();
}

function getDefaultQuarter() {
  return Math.floor((new Date().getMonth() + 3) / 3);
}

export function AssessmentForm({ categories }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<{ type: "idle" | "error" | "success"; message?: string }>({
    type: "idle",
  });
  const [isPending, startTransition] = useTransition();
  const [previousScores, setPreviousScores] = useState<Record<string, number> | null>(null);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  // Track initial values for comparison when there's no previous assessment
  const [initialValues, setInitialValues] = useState<Record<string, number>>({});

  const defaultAnswers = useMemo(
    () =>
      Object.fromEntries(
        categories.flatMap((category) =>
          category.questions.map((question) => [question.id, 3]),
        ),
      ),
    [categories],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      year: getDefaultYear(),
      quarter: getDefaultQuarter(),
      answers: defaultAnswers,
    },
  });

  const { register, control, handleSubmit, setValue, watch } = form;

  // Watch year and quarter to fetch previous scores when they change
  const selectedYear = watch("year");
  const selectedQuarter = watch("quarter");

  // Fetch previous assessment scores when year/quarter changes
  useEffect(() => {
    const year = Number(selectedYear) || getDefaultYear();
    const quarter = Number(selectedQuarter) || getDefaultQuarter();
    
    if (!year || !quarter) return;

    setIsLoadingPrevious(true);
    getPreviousAssessmentScores(year, quarter)
      .then((result) => {
        if (result.error) {
          setPreviousScores(null);
          setIsLoadingPrevious(false);
          return;
        }
        
        // Set previous scores state FIRST
        setPreviousScores(result.data || null);
        
        // Update form values with previous scores AFTER setting state
        if (result.data && Object.keys(result.data).length > 0) {
          const newInitialValues: Record<string, number> = {};
          categories.forEach((category) => {
            category.questions.forEach((question) => {
              const prevScore = result.data?.[question.id];
              if (prevScore !== undefined && prevScore !== null) {
                setValue(`answers.${question.id}`, prevScore);
                newInitialValues[question.id] = prevScore;
              } else {
                // Use default value of 3
                newInitialValues[question.id] = 3;
              }
            });
          });
          setInitialValues(newInitialValues);
        } else {
          // Set initial values to defaults (3)
          const defaultInitials: Record<string, number> = {};
          categories.forEach((category) => {
            category.questions.forEach((question) => {
              defaultInitials[question.id] = 3;
            });
          });
          setInitialValues(defaultInitials);
        }
      })
      .catch((error) => {
        console.error("Error fetching previous scores:", error);
        setPreviousScores(null);
      })
      .finally(() => {
        setIsLoadingPrevious(false);
      });
  }, [selectedYear, selectedQuarter, categories, setValue]);

  const onSubmit = handleSubmit((values) => {
    setStatus({ type: "idle" });
    startTransition(async () => {
      const result = await submitAssessment(values);
      if (result.error) {
        setStatus({ type: "error", message: result.error });
        return;
      }

      setStatus({
        type: "success",
        message: "Assessment submitted! Redirecting to dashboard...",
      });
      setTimeout(() => router.push("/dashboard"), 1200);
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid gap-4 rounded-3xl border border-amber-100 bg-white/80 p-6 shadow-xl shadow-amber-100/60 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Assessment year
          <select
            className="rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-sun-400 focus:outline-none focus:ring-2 focus:ring-sun-200"
            {...register("year", { valueAsNumber: true })}
          >
            {Array.from({ length: 6 }).map((_, index) => {
              const year = getDefaultYear() - 1 + index;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Quarter
          <select
            className="rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-sun-400 focus:outline-none focus:ring-2 focus:ring-sun-200"
            {...register("quarter", { valueAsNumber: true })}
          >
            {[1, 2, 3, 4].map((quarter) => (
              <option key={quarter} value={quarter}>
                Q{quarter}
              </option>
            ))}
          </select>
        </label>
      </div>

      {status.message && (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm ${
            status.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {status.message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {categories.map((category) => (
          <section
            key={category.id}
            className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-lg shadow-slate-200/60"
          >
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                {category.pillar}
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                {category.label}
              </h2>
            </div>
            <div className="space-y-4">
              {category.questions.map((question) => {
                const previousValue = previousScores?.[question.id];
                // Include previousValue in key to force re-render when it changes
                return (
                <div
                  key={`${question.id}-prev-${previousValue ?? 'none'}`}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                >
                  <p className="text-sm text-slate-700">{question.prompt}</p>
                  <Controller
                    control={control}
                    name={`answers.${question.id}`}
                    render={({ field }) => {
                      const currentValue = field.value ?? 3;
                      const initialValue = initialValues[question.id] ?? 3;
                      
                      return (
                        <QuestionSlider
                          key={`slider-${question.id}-${previousValue ?? 'none'}-${initialValue}`}
                          questionId={question.id}
                          currentValue={currentValue}
                          previousValue={previousValue}
                          initialValue={initialValue}
                          onChange={(value) => field.onChange(value)}
                        />
                      );
                    }}
                  />
                </div>
              )})}
            </div>
          </section>
        ))}
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center rounded-3xl bg-gradient-to-r from-sun-400 to-sun-500 px-5 py-4 text-lg font-semibold text-slate-950 shadow-lg shadow-sun-200/80 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 disabled:opacity-60"
        disabled={isPending}
      >
        {isPending ? "Submitting..." : "Submit assessment"}
      </button>
    </form>
  );
}

