"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitAssessment } from "@/app/assessments/actions";

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

  const defaultAnswers = useMemo(
    () =>
      Object.fromEntries(
        categories.flatMap((category) =>
          category.questions.map((question) => [question.id, 3]),
        ),
      ),
    [categories],
  );

  const { register, control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      year: getDefaultYear(),
      quarter: getDefaultQuarter(),
      answers: defaultAnswers,
    },
  });

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
              {category.questions.map((question) => (
                <div
                  key={question.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                >
                  <p className="text-sm text-slate-700">{question.prompt}</p>
                  <Controller
                    control={control}
                    name={`answers.${question.id}`}
                    render={({ field }) => (
                      <div className="mt-5 space-y-2">
                        <input
                          type="range"
                          min={1}
                          max={5}
                          step={1}
                          value={field.value ?? 3}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value))
                          }
                          className="w-full accent-sun-500"
                        />
                        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-500">
                          <span>Disagree</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-sm font-semibold text-slate-900">
                            {field.value ?? 3}
                          </span>
                          <span>Strongly agree</span>
                        </div>
                      </div>
                    )}
                  />
                </div>
              ))}
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

