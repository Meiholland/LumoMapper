import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local file
const envPath = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value.trim();
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const companyName = process.argv[2] || "Integer Technologies";
const year = parseInt(process.argv[3]) || 2025;
const quarter = parseInt(process.argv[4]) || 4;

console.log(`\n📊 Assessment Data for ${companyName} Q${quarter} ${year}\n`);
console.log("=".repeat(80));

// Find company
const { data: companies, error: companyError } = await supabase
  .from("companies")
  .select("id, name")
  .ilike("name", `%${companyName}%`);

if (companyError || !companies || companies.length === 0) {
  console.error(`❌ Company "${companyName}" not found.`);
  process.exit(1);
}

if (companies.length > 1) {
  console.error(`❌ Multiple companies match "${companyName}":`);
  companies.forEach((c) => console.error(`   - ${c.name}`));
  process.exit(1);
}

const companyId = companies[0].id;
console.log(`✓ Found company: ${companies[0].name} (${companyId})\n`);

// Find assessment period
const { data: period, error: periodError } = await supabase
  .from("assessment_periods")
  .select("id, year, quarter, submitted_at")
  .eq("company_id", companyId)
  .eq("year", year)
  .eq("quarter", quarter)
  .single();

if (periodError || !period) {
  console.error(`❌ Assessment for ${companyName} Q${quarter} ${year} not found.`);
  process.exit(1);
}

console.log(`✓ Found assessment period: ${period.id}`);
console.log(`  Submitted at: ${new Date(period.submitted_at).toLocaleString()}\n`);

// Fetch all responses
const { data: responses, error: responsesError } = await supabase
  .from("assessment_responses")
  .select("score, question_id")
  .eq("assessment_period_id", period.id);

if (responsesError) {
  console.error("❌ Failed to fetch responses:", responsesError);
  process.exit(1);
}

if (!responses || responses.length === 0) {
  console.error("❌ No responses found for this assessment.");
  process.exit(1);
}

// Fetch all questions with their categories
const questionIds = responses.map((r) => r.question_id);
const { data: questions, error: questionsError } = await supabase
  .from("questions")
  .select(
    `
    id,
    prompt,
    sequence,
    categories!inner (
      id,
      label,
      pillar,
      sequence
    )
    `
  )
  .in("id", questionIds);

if (questionsError) {
  console.error("❌ Failed to fetch questions:", questionsError);
  process.exit(1);
}

// Create a map of question_id -> question data
const questionMap = new Map();
for (const q of questions) {
  questionMap.set(q.id, q);
}

// Combine responses with question data
const combined = responses
  .map((r) => {
    const question = questionMap.get(r.question_id);
    if (!question) return null;
    return {
      score: r.score,
      prompt: question.prompt,
      sequence: question.sequence,
      category: question.categories,
    };
  })
  .filter(Boolean)
  .sort((a, b) => {
    // Sort by category sequence, then question sequence
    if (a.category.sequence !== b.category.sequence) {
      return a.category.sequence - b.category.sequence;
    }
    return a.sequence - b.sequence;
  });

// Group by pillar and category
const grouped = {};
for (const item of combined) {
  const pillar = item.category.pillar;
  const catLabel = item.category.label;

  if (!grouped[pillar]) {
    grouped[pillar] = {};
  }
  if (!grouped[pillar][catLabel]) {
    grouped[pillar][catLabel] = [];
  }

  grouped[pillar][catLabel].push({
    prompt: item.prompt,
    score: item.score,
    sequence: item.sequence,
  });
}

// Print organized output
for (const [pillar, categories] of Object.entries(grouped)) {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`📌 PILLAR: ${pillar.toUpperCase()}`);
  console.log("─".repeat(80));

  for (const [catLabel, questions] of Object.entries(categories)) {
    console.log(`\n  📁 Category: ${catLabel}`);
    console.log("  " + "─".repeat(76));

    // Sort questions by sequence
    questions.sort((a, b) => a.sequence - b.sequence);

    let totalScore = 0;
    for (const q of questions) {
      totalScore += q.score;
      const scoreBar = "█".repeat(q.score) + "░".repeat(5 - q.score);
      console.log(`    [${q.score}/5] ${scoreBar}  ${q.prompt}`);
    }

    const avgScore = (totalScore / questions.length).toFixed(2);
    console.log(`    ── Average: ${avgScore}/5 (${questions.length} questions)`);
  }
}

// Summary
const totalResponses = combined.length;
const totalScore = combined.reduce((sum, r) => sum + r.score, 0);
const overallAvg = (totalScore / totalResponses).toFixed(2);

console.log(`\n${"=".repeat(80)}`);
console.log(`📈 SUMMARY`);
console.log("=".repeat(80));
console.log(`Total responses: ${totalResponses}`);
console.log(`Overall average score: ${overallAvg}/5`);
console.log("=".repeat(80));
console.log();

