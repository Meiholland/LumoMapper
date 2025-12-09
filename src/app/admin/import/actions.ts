"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { isAdmin } from "@/lib/supabase/admin";

type ImportPayload = {
  companyName: string;
  year: number;
  quarter: number;
  jsonData: string;
};

type StatementScore = {
  statement: string;
  score: number | null;
};

type CategoryData = Record<string, StatementScore[]>;
type ImportData = Record<string, CategoryData>;

export async function importAssessmentFromJson(payload: ImportPayload) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const userIsAdmin = await isAdmin(supabase, session);
  if (!userIsAdmin) {
    return { error: "Not authorized. Admin access required." };
  }

  try {
    // Escape special characters in company name to prevent pattern injection
    function escapeLikePattern(input: string): string {
      return input.replace(/[%_]/g, '\\$&');
    }

    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .ilike("name", escapeLikePattern(payload.companyName));

    if (!companies || companies.length === 0) {
      return { error: "Company not found or access denied." };
    }

    if (companies.length > 1) {
      return {
        error: "Multiple companies match. Please be more specific.",
      };
    }

    const companyId = companies[0].id;
    const quarter = Number(payload.quarter);

    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      return { error: "Quarter must be between 1 and 4." };
    }

    const year = Number(payload.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { error: "Year must be between 2000 and 2100." };
    }

    // Validate JSON size to prevent DoS attacks
    const MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB
    if (payload.jsonData.length > MAX_JSON_SIZE) {
      return { error: "JSON payload exceeds maximum size limit (10MB). Please reduce the size and try again." };
    }

    let parsedData: ImportData;
    try {
      parsedData = JSON.parse(payload.jsonData);
    } catch {
      return { error: "Invalid JSON. Please check your paste." };
    }

    // Helper function to normalize text for matching
    function normalizeText(text: string): string {
      return text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .replace(/[.,;:!?]/g, "") // Remove punctuation
        .replace(/['"]/g, ""); // Remove quotes
    }

    // Fetch or create categories as we process them
    const categoryMap = new Map<string, string>(); // key: "pillar|label", value: category_id

    // Helper to get or create category
    async function getOrCreateCategory(
      pillar: string,
      label: string,
    ): Promise<string | null> {
      const key = `${pillar}|${label}`;
      if (categoryMap.has(key)) {
        return categoryMap.get(key)!;
      }

      // Try to find existing category
      const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .eq("pillar", pillar)
        .eq("label", label)
        .single();

      if (existing) {
        categoryMap.set(key, existing.id);
        return existing.id;
      }

      // Create new category
      // Get max sequence for this pillar to append new category
      const { data: maxSeq } = await supabase
        .from("categories")
        .select("sequence")
        .eq("pillar", pillar)
        .order("sequence", { ascending: false })
        .limit(1)
        .single();

      const { data: newCategory, error } = await supabase
        .from("categories")
        .insert({
          pillar,
          label,
          sequence: (maxSeq?.sequence ?? 0) + 1,
        })
        .select("id")
        .single();

      if (error || !newCategory) {
        // console.error(`[Import] Failed to create category ${pillar} > ${label}:`, error);
        return null;
      }

      categoryMap.set(key, newCategory.id);
      return newCategory.id;
    }

    // Fetch company-specific questions first, then standard questions as fallback
    const { data: companyQuestions } = await supabase
      .from("questions")
      .select("id, prompt, category_id, sequence")
      .eq("company_id", companyId)
      .order("sequence");

    const { data: standardQuestions } = await supabase
      .from("questions")
      .select("id, prompt, category_id, sequence")
      .is("company_id", null)
      .order("sequence");

    // Create maps for quick lookup
    const companyQuestionMap = new Map<string, string>(); // normalized prompt -> question_id
    const standardQuestionMap = new Map<string, string>(); // normalized prompt -> question_id

    // console.log(`[Import] Loading company-specific questions (company_id: ${companyId})...`);
    for (const q of companyQuestions || []) {
      const normalized = normalizeText(q.prompt);
      companyQuestionMap.set(normalized, q.id);
      // console.log(`[Import]   Company Q: "${q.prompt.substring(0, 60)}${q.prompt.length > 60 ? "..." : ""}" → normalized: "${normalized.substring(0, 60)}${normalized.length > 60 ? "..." : ""}"`);
    }

    // console.log(`[Import] Loading standard questions (company_id: NULL)...`);
    for (const q of standardQuestions || []) {
      const normalized = normalizeText(q.prompt);
      standardQuestionMap.set(normalized, q.id);
    }
    // console.log(`[Import] Loaded ${standardQuestions?.length ?? 0} standard questions`);

    // Helper to get or create question for this company
    async function getOrCreateQuestion(
      statement: string,
      categoryId: string,
      sequence: number,
    ): Promise<string | null> {
      const normalized = normalizeText(statement);

      // First check company-specific questions
      if (companyQuestionMap.has(normalized)) {
        const questionId = companyQuestionMap.get(normalized)!;
        // console.log(`[Import]   ✓ Found in company-specific questions (ID: ${questionId})`);
        return questionId;
      }
      // console.log(`[Import]   ✗ Not found in company-specific questions, will create new`);

      // Create company-specific question (even if it matches a standard question,
      // we create a company-specific copy to allow for future customization)
      // console.log(`[Import]   Creating new question: company_id=${companyId}, category_id=${categoryId}, sequence=${sequence}`);
      const { data: newQuestion, error } = await supabase
        .from("questions")
        .insert({
          company_id: companyId,
          category_id: categoryId,
          prompt: statement,
          sequence,
        })
        .select("id")
        .single();

      if (error || !newQuestion) {
        // console.error(`[Import]   ✗ Insert failed:`, error);
        // Might be a duplicate due to race condition, try to fetch it
        // console.log(`[Import]   Attempting to fetch existing question...`);
        const { data: existing, error: fetchError } = await supabase
          .from("questions")
          .select("id")
          .eq("company_id", companyId)
          .eq("category_id", categoryId)
          .eq("prompt", statement)
          .single();

        if (existing) {
          // console.log(`[Import]   ✓ Found existing question (ID: ${existing.id})`);
          companyQuestionMap.set(normalized, existing.id);
          return existing.id;
        }

        // console.error(
        //   `[Import]   ✗ Failed to create or find question "${statement.substring(0, 60)}...":`,
        //   error || fetchError,
        // );
        return null;
      }

      // console.log(`[Import]   ✓ Created new question (ID: ${newQuestion.id})`);
      companyQuestionMap.set(normalized, newQuestion.id);
      return newQuestion.id;
    }

    const responses: Array<{ question_id: string; score: number }> = [];
    const createdQuestions: string[] = [];
    const failedStatements: Array<{ statement: string; reason: string; pillar: string; category: string }> = [];
    let totalStatementsProcessed = 0;

    // console.log("[Import] Starting to process statements...");
    // console.log(`[Import] Company-specific questions loaded: ${companyQuestionMap.size}`);
    // console.log(`[Import] Standard questions loaded: ${standardQuestionMap.size}`);

    // Process statements from JSON and create questions on-the-fly
    for (const [pillar, categories] of Object.entries(parsedData)) {
      // console.log(`[Import] Processing pillar: "${pillar}"`);
      for (const [categoryName, statements] of Object.entries(categories)) {
        if (!Array.isArray(statements)) {
          // console.warn(
          //   `[Import] ❌ Expected array for ${pillar} > ${categoryName}, got:`,
          //   typeof statements,
          // );
          failedStatements.push({
            statement: `Category: ${categoryName}`,
            reason: `Expected array, got ${typeof statements}`,
            pillar,
            category: categoryName,
          });
          continue;
        }

        // console.log(`[Import] Processing category: "${pillar} > ${categoryName}" (${statements.length} statements)`);

        // Get or create category
        const categoryId = await getOrCreateCategory(pillar, categoryName);
        if (!categoryId) {
          // console.error(`[Import] ❌ Failed to get/create category: ${pillar} > ${categoryName}`);
          failedStatements.push({
            statement: `Category: ${categoryName}`,
            reason: "Failed to get or create category",
            pillar,
            category: categoryName,
          });
          continue;
        }
        // console.log(`[Import] ✓ Category ID: ${categoryId} for "${pillar} > ${categoryName}"`);

        // Process each statement
        for (let idx = 0; idx < statements.length; idx++) {
          const item = statements[idx];
          totalStatementsProcessed++;

          if (!item || typeof item !== "object" || !("statement" in item)) {
            // console.warn(
            //   `[Import] ❌ Invalid statement item #${idx + 1} in ${pillar} > ${categoryName}:`,
            //   JSON.stringify(item),
            // );
            failedStatements.push({
              statement: `Item #${idx + 1}`,
              reason: "Invalid item structure (not an object or missing 'statement' field)",
              pillar,
              category: categoryName,
            });
            continue;
          }

          const { statement, score } = item as StatementScore;

          if (!statement || typeof statement !== "string") {
            // console.warn(
            //   `[Import] ❌ Missing or invalid statement #${idx + 1} in ${pillar} > ${categoryName}:`,
            //   JSON.stringify(item),
            // );
            failedStatements.push({
              statement: `Item #${idx + 1}`,
              reason: "Statement is missing or not a string",
              pillar,
              category: categoryName,
            });
            continue;
          }

          const normalizedStatement = normalizeText(statement);
          // console.log(`[Import] Processing statement #${idx + 1}: "${statement.substring(0, 80)}${statement.length > 80 ? "..." : ""}"`);
          // console.log(`[Import]   Normalized: "${normalizedStatement.substring(0, 80)}${normalizedStatement.length > 80 ? "..." : ""}"`);

          // Convert score to number
          let finalScore = 0;
          if (score !== null && score !== undefined) {
            const numValue =
              typeof score === "string" ? parseFloat(score) : Number(score);
            if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= 5) {
              finalScore = Math.round(numValue);
            } else {
              // console.warn(
              //   `[Import] ⚠️ Invalid score for "${statement.substring(0, 60)}...": ${score}. Using 0.`,
              // );
            }
          }

          // Get or create question for this company
          const questionId = await getOrCreateQuestion(
            statement,
            categoryId,
            idx + 1,
          );

          if (!questionId) {
            // console.error(
            //   `[Import] ❌ FAILED to get/create question for: "${statement.substring(0, 80)}${statement.length > 80 ? "..." : ""}"`,
            // );
            // console.error(`[Import]   Category ID: ${categoryId}, Sequence: ${idx + 1}`);
            failedStatements.push({
              statement: statement,
              reason: "Failed to get or create question in database",
              pillar,
              category: categoryName,
            });
            continue;
          }

          // console.log(`[Import] ✓ Question ID: ${questionId} for statement #${idx + 1}`);

          // Track if this was a newly created question
          if (!companyQuestionMap.has(normalizedStatement)) {
            createdQuestions.push(statement);
            // console.log(`[Import]   → New question created`);
          } else {
            // console.log(`[Import]   → Using existing question`);
          }

          responses.push({
            question_id: questionId,
            score: finalScore,
          });

          // console.log(
          //   `[Import] ✓ Successfully processed: "${statement.substring(0, 60)}..." → Score: ${finalScore}`,
          // );
        }
      }
    }

    // console.log(
    //   `[Import] ===== SUMMARY =====`,
    // );
    // console.log(
    //   `[Import] Total statements processed: ${totalStatementsProcessed}`,
    // );
    // console.log(
    //   `[Import] Successful responses created: ${responses.length}`,
    // );
    // console.log(
    //   `[Import] New company-specific questions created: ${createdQuestions.length}`,
    // );
    // console.log(
    //   `[Import] Failed statements: ${failedStatements.length}`,
    // );

    if (failedStatements.length > 0) {
      // console.error(`[Import] ===== FAILED STATEMENTS =====`);
      // failedStatements.forEach((failed, index) => {
      //   console.error(`[Import] ${index + 1}. Pillar: "${failed.pillar}" > Category: "${failed.category}"`);
      //   console.error(`[Import]    Statement: "${failed.statement.substring(0, 100)}${failed.statement.length > 100 ? "..." : ""}"`);
      //   console.error(`[Import]    Reason: ${failed.reason}`);
      // });
    }

    if (responses.length === 0) {
      // console.error(`[Import] ===== ERROR: NO VALID RESPONSES =====`);
      // console.error(`[Import] Total statements in JSON: ${totalStatementsProcessed}`);
      // console.error(`[Import] Failed statements: ${failedStatements.length}`);
      // console.error(`[Import] This means all statements failed to process.`);
      
      let errorMessage = "No valid responses found. Check that statement text matches the question bank.\n\n";
      errorMessage += `Total statements processed: ${totalStatementsProcessed}\n`;
      errorMessage += `Failed statements: ${failedStatements.length}\n\n`;
      
      if (failedStatements.length > 0) {
        errorMessage += "First few failures:\n";
        failedStatements.slice(0, 5).forEach((failed, idx) => {
          errorMessage += `${idx + 1}. ${failed.pillar} > ${failed.category}: ${failed.reason}\n`;
          errorMessage += `   "${failed.statement.substring(0, 60)}${failed.statement.length > 60 ? "..." : ""}"\n`;
        });
        if (failedStatements.length > 5) {
          errorMessage += `\n... and ${failedStatements.length - 5} more (check server console for full details)`;
        }
      }
      
      return {
        error: errorMessage,
      };
    }

    // Check if assessment already exists and delete it (cascades to responses)
    const { data: existingPeriod } = await supabase
      .from("assessment_periods")
      .select("id")
      .eq("company_id", companyId)
      .eq("year", payload.year)
      .eq("quarter", quarter)
      .single();

    if (existingPeriod) {
      const { error: deleteError } = await supabase
        .from("assessment_periods")
        .delete()
        .eq("id", existingPeriod.id);

      if (deleteError) {
        throw new Error(
          `Failed to delete existing assessment: ${deleteError.message}`,
        );
      }
    }

    const { data: period, error: periodError } = await supabase
      .from("assessment_periods")
      .insert({
        company_id: companyId,
        year: payload.year,
        quarter,
      })
      .select("id")
      .single();

    if (periodError || !period) {
      throw new Error(periodError?.message ?? "Failed to create assessment period.");
    }

    const assessmentResponses = responses.map((r) => ({
      assessment_period_id: period.id,
      question_id: r.question_id,
      score: r.score,
    }));

    const { error: responsesError } = await supabase
      .from("assessment_responses")
      .insert(assessmentResponses);

    if (responsesError) {
      throw new Error(responsesError.message);
    }

    revalidatePath("/dashboard");

    let message = `${existingPeriod ? "Overwritten" : "Imported"} ${responses.length} responses for ${payload.companyName} Q${quarter} ${payload.year}.`;
    message += `\n\nProcessed: ${totalStatementsProcessed} statements`;
    
    if (createdQuestions.length > 0) {
      message += `\nCreated: ${createdQuestions.length} new company-specific question(s)`;
      if (createdQuestions.length <= 5) {
        createdQuestions.forEach((q) => {
          message += `\n  - "${q.substring(0, 80)}${q.length > 80 ? "..." : ""}"`;
        });
      } else {
        createdQuestions.slice(0, 3).forEach((q) => {
          message += `\n  - "${q.substring(0, 80)}${q.length > 80 ? "..." : ""}"`;
        });
        message += `\n  ... and ${createdQuestions.length - 3} more`;
      }
    }

    // Log detailed summary
    // console.log("[Import] Summary:", {
    //   totalStatementsProcessed,
    //   responsesCreated: responses.length,
    //   newQuestionsCreated: createdQuestions.length,
    // });
    
    return {
      success: true,
      message,
    };
  } catch (error) {
    // console.error("Import failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unexpected error during import.",
    };
  }
}

