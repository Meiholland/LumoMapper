import { AssessmentPreview } from "@/components/assessment-preview";
import { AuthCard } from "@/components/auth-card";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="relative min-h-screen overflow-hidden pb-16 pt-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.5),_transparent_60%)]" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 md:px-6 lg:px-8">
        {message && (
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow">
            {message}
          </div>
        )}
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative flex flex-col gap-6 rounded-3xl border border-white/60 bg-white/50 p-10 text-slate-900 shadow-xl shadow-sun-200/30 backdrop-blur">
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-widest text-slate-500">
              <span className="h-2 w-2 rounded-full bg-sun-500" />
              Portfolio Intelligence
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Discover your growth readiness with radar clarity.
            </h1>
            <p className="text-base text-slate-600">
              Track your company's progress quarter by quarter. See where you're
              strong, identify gaps, and get clear insights on what to focus on next.
              Your growth journey, visualized.
            </p>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sun-500" />
                <span>Quick 5-minute quarterly assessments that reveal your strengths and blind spots</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sun-500" />
                <span>Visual radar charts showing your progress across key business areas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sun-500" />
                <span>Compare your current quarter with past performance to track improvement</span>
              </li>
            </ul>
            <div className="mt-4 text-xs uppercase tracking-[0.4em] text-slate-500">
              Get started in seconds
            </div>
            <AuthCard />
          </div>
          <AssessmentPreview />
        </section>
      </div>
    </main>
  );
}
