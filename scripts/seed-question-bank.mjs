import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const questionBankPath = path.resolve(
  __dirname,
  "..",
  "docs",
  "question-bank.json",
);

const questionBank = JSON.parse(
  fs.readFileSync(questionBankPath, { encoding: "utf-8" }),
);

async function upsertQuestionBank() {
  let categorySequence = 1;

  for (const [pillar, categories] of Object.entries(questionBank)) {
    for (const [label, questions] of Object.entries(categories)) {
      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .upsert(
          { pillar, label, sequence: categorySequence },
          { onConflict: "pillar,label" },
        )
        .select()
        .single();

      if (categoryError) {
        console.error(
          `Failed to upsert category "${label}" (${pillar}):`,
          categoryError.message,
        );
        process.exitCode = 1;
        continue;
      }

      console.log(`Category synced: ${pillar} → ${label}`);

      for (const [index, prompt] of questions.entries()) {
        const { error: questionError } = await supabase
          .from("questions")
          .upsert(
            {
              category_id: category.id,
              company_id: null, // Standard questions (for companies without imports)
              prompt,
              sequence: index + 1,
            },
            { onConflict: "category_id,company_id,prompt" },
          );

        if (questionError) {
          console.error(
            `  ↳ Failed to upsert question "${prompt}":`,
            questionError.message,
          );
          process.exitCode = 1;
        } else {
          console.log(`    ↳ Question synced (#${index + 1})`);
        }
      }

      categorySequence += 1;
    }
  }
}

upsertQuestionBank()
  .then(() => console.log("Question bank sync completed."))
  .catch((error) => {
    console.error("Unexpected error while seeding question bank:", error);
    process.exit(1);
  });

