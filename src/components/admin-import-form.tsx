"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { importAssessmentFromJson } from "@/app/admin/import/actions";
import { portfolioCompanies } from "@/data/companies";

const schema = z.object({
  companyName: z.string().min(1, "Select a company"),
  year: z.number().min(2015).max(2100),
  quarter: z.number().int().min(1).max(4),
  jsonData: z.string().min(10, "Paste the JSON assessment data"),
});

type FormValues = z.infer<typeof schema>;

function getDefaultYear() {
  return new Date().getFullYear();
}

export function AdminImportForm() {
  const [status, setStatus] = useState<{
    type: "idle" | "error" | "success";
    message?: string;
  }>({ type: "idle" });
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "",
      year: getDefaultYear(),
      quarter: 1,
      jsonData: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setStatus({ type: "idle" });
    startTransition(async () => {
      const result = await importAssessmentFromJson(values);
      if (result.error) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStatus({
        type: "success",
        message: result.message ?? "Assessment imported successfully.",
      });
      
      // Reset form after successful import
      reset({
        companyName: "",
        year: getDefaultYear(),
        quarter: 1,
        jsonData: "",
      });
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setStatus({ type: "idle" });
      }, 5000);
    });
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-6 md:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700">
          Company
          <select
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-200"
            {...register("companyName")}
          >
            <option value="">Select company...</option>
            {portfolioCompanies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
          {errors.companyName && (
            <p className="mt-1 text-sm text-rose-500">
              {errors.companyName.message}
            </p>
          )}
        </label>

          <label className="block text-sm font-medium text-slate-700">
            Year
            <input
              type="number"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-200"
              {...register("year", { valueAsNumber: true })}
            />
          {errors.year && (
            <p className="mt-1 text-sm text-rose-500">{errors.year.message}</p>
          )}
        </label>

          <label className="block text-sm font-medium text-slate-700">
            Quarter
            <select
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-200"
              {...register("quarter", { valueAsNumber: true })}
            >
            <option value={1}>Q1</option>
            <option value={2}>Q2</option>
            <option value={3}>Q3</option>
            <option value={4}>Q4</option>
          </select>
          {errors.quarter && (
            <p className="mt-1 text-sm text-rose-500">
              {errors.quarter.message}
            </p>
          )}
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        JSON Assessment Data
        <textarea
          rows={20}
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-200"
          placeholder='Paste JSON here, e.g. { "BUSINESS CONCEPT & MARKET": { "Value proposition": [{ "statement": "...", "score": 4 }] } }'
          {...register("jsonData")}
        />
        {errors.jsonData && (
          <p className="mt-1 text-sm text-rose-500">
            {errors.jsonData.message}
          </p>
        )}
      </label>

      {status.message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm whitespace-pre-line ${
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
        className="flex w-full items-center justify-center rounded-3xl bg-gradient-to-r from-sun-400 to-sun-500 px-5 py-4 text-lg font-semibold text-slate-950 shadow-lg shadow-sun-200/80 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 disabled:opacity-60"
        disabled={isPending}
      >
        {isPending ? "Importing..." : "Import Assessment"}
      </button>
    </form>
  );
}

