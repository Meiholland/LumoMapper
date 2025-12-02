import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { getOrCreatePortalUser } from "@/lib/supabase/portal-user";
import { AssessmentForm } from "@/components/assessment-form";

export default async function NewAssessmentPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/?message=Please%20log%20in%20to%20start%20an%20assessment.");
  }

  const portalUser = await getOrCreatePortalUser(supabase, session);

  if (!portalUser.company_id) {
    throw new Error("No company assigned to your account.");
  }

  // Check if company has company-specific questions
  const { data: companyQuestions } = await supabase
    .from("questions")
    .select("id")
    .eq("company_id", portalUser.company_id)
    .limit(1);

  // Fetch questions: company-specific if they exist, otherwise standard
  let questionsQuery = supabase
    .from("questions")
    .select("id, prompt, sequence, category_id, categories(id, pillar, label, sequence)")
    .order("sequence");

  if (companyQuestions && companyQuestions.length > 0) {
    // Company has custom questions, use those
    questionsQuery = questionsQuery.eq("company_id", portalUser.company_id);
  } else {
    // No custom questions, use standard questions (company_id IS NULL)
    questionsQuery = questionsQuery.is("company_id", null);
  }

  const { data: questions, error: questionsError } = await questionsQuery;

  if (questionsError || !questions) {
    throw new Error(questionsError?.message ?? "Unable to load question bank.");
  }

  // Fetch all categories
  const { data: allCategories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, pillar, label, sequence")
    .order("sequence");

  if (categoriesError || !allCategories) {
    throw new Error(categoriesError?.message ?? "Unable to load categories.");
  }

  // Group questions by category
  const categoryMap = new Map(
    allCategories.map((cat) => [
      cat.id,
      {
        id: cat.id,
        pillar: cat.pillar,
        label: cat.label,
        sequence: cat.sequence,
        questions: [] as Array<{ id: string; prompt: string }>,
      },
    ]),
  );

  for (const question of questions) {
    const category = question.categories;
    if (!category || !categoryMap.has(category.id)) continue;

    categoryMap.get(category.id)!.questions.push({
      id: question.id,
      prompt: question.prompt,
    });
  }

  // Convert to array and sort by sequence
  const categories = Array.from(categoryMap.values())
    .sort((a, b) => a.sequence - b.sequence)
    .map((cat) => ({
      id: cat.id,
      pillar: cat.pillar,
      label: cat.label,
      questions: cat.questions,
    }));

  const formatted = categories;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-12 md:px-8">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.5em] text-slate-500">
          Quarterly assessment
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Tell us where your company stands this quarter.
        </h1>
        <p className="text-base text-slate-600">
          Answer each statement on a 1-5 scale. We use this to update your radar
          charts and highlight strengths and gaps across{" "}
          <span className="font-medium">{portalUser.full_name}</span>’s company.
        </p>
      </div>
      <AssessmentForm categories={formatted} />
    </main>
  );
}

