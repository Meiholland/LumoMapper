#!/usr/bin/env node

/**
 * Debug script to show what the quarterly review prompt looks like for a company
 * Usage: node scripts/debug-quarterly-review-prompt.mjs "Beyond Weather"
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatAssessmentData(categories) {
  const byPillar = {};

  for (const category of categories) {
    if (!byPillar[category.pillar]) {
      byPillar[category.pillar] = {};
    }
    const score = category.axes[0]?.score ?? 0;
    byPillar[category.pillar][category.categoryLabel] = score;
  }

  return byPillar;
}

function formatMonthlyReports(reports) {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return reports.map((report) => ({
    month: monthNames[report.month - 1],
    challenges: {
      team: report.challenge_team,
      product: report.challenge_product,
      sales: report.challenge_sales,
      marketing: report.challenge_marketing,
      finance: report.challenge_finance,
      fundraise: report.challenge_fundraise,
    },
  }));
}

function buildGeminiPrompt(
  companyName,
  currentYear,
  currentQuarter,
  previousYear,
  previousQuarter,
  currentData,
  previousData,
  monthlyReports,
) {
  return `You are an expert portfolio analyst reviewing quarterly assessment data for venture-backed startups. Analyze the following data and provide insights.

## COMPANY CONTEXT
Company: ${companyName}
Current Quarter: Q${currentQuarter} ${currentYear}
Previous Quarter: Q${previousQuarter} ${previousYear}

## ASSESSMENT DATA

### Current Quarter (Q${currentQuarter} ${currentYear})
${JSON.stringify(currentData, null, 2)}

### Previous Quarter (Q${previousQuarter} ${previousYear})
${JSON.stringify(previousData, null, 2)}

## MONTHLY REPORTS (Latest Quarter)
${JSON.stringify(monthlyReports, null, 2)}

## ANALYSIS REQUIREMENTS

1. **Pattern Detection**: Identify meaningful changes (>1.0 point difference) between quarters
   - Flag categories that moved from weak (<2.5) to strong (>3.5)
   - Flag categories that dropped from strong (>3.5) to weak (<2.5)
   - Identify any category changes >1.0 points

2. **Leadership Shift Detection**: 
   - Compare "Product leadership" vs "Market leadership" scores within "BUSINESS CONCEPT & MARKET" pillar
   - If one was stronger than the other in previous quarter and this has reversed, flag this as a significant shift
   - Note the magnitude of the shift

3. **Correlation Analysis**:
   - Compare assessment score changes with monthly report challenges
   - If a category score decreased and that area appears in monthly challenges, highlight the correlation
   - If a category score increased despite challenges mentioned, note this as positive resilience

4. **Narrative Generation**:
   - Write a 2-3 sentence executive summary highlighting the most significant changes
   - Generate 3-5 key insights (each 1-2 sentences) focusing on:
     * Meaningful score changes (>1.0 points)
     * Leadership shifts (Product vs Market)
     * Correlations between assessment scores and monthly challenges
     * Areas of concern or strength

5. **Recommendations**:
   - Provide 2-3 very short, actionable recommendations (one sentence each)
   - Focus on addressing identified gaps or reinforcing strengths

## OUTPUT FORMAT

Provide your analysis in the following JSON structure:

{
  "executive_summary": "2-3 sentence summary here",
  "insights": [
    {
      "title": "Short insight title",
      "description": "1-2 sentence description",
      "type": "improvement|decline|shift|correlation",
      "category": "Category name",
      "pillar": "Pillar name",
      "change": 1.5,
      "current_score": 4.0,
      "previous_score": 2.5
    }
  ],
  "recommendations": [
    "Short actionable recommendation 1",
    "Short actionable recommendation 2"
  ]
}

Be concise, data-driven, and focus on actionable insights. Prioritize insights that show meaningful changes (>1.0 points) or interesting patterns.`;
}

async function getAssessmentWithScores(companyId, periodId) {
  // Check if company has company-specific questions
  const { data: companyQuestions } = await supabase
    .from("questions")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);

  const questionsQuery = supabase
    .from("questions")
    .select(
      `
      id,
      prompt,
      sequence,
      categories!inner (
        id,
        label,
        pillar
      )
    `,
    )
    .order("sequence");

  if (companyQuestions && companyQuestions.length > 0) {
    questionsQuery.eq("company_id", companyId);
  } else {
    questionsQuery.is("company_id", null);
  }

  const { data: questions, error: questionsError } = await questionsQuery;

  if (questionsError || !questions) {
    return { error: "Failed to load questions" };
  }

  const { data: responses, error: responsesError } = await supabase
    .from("assessment_responses")
    .select("question_id, score")
    .eq("assessment_period_id", periodId);

  if (responsesError) {
    return { error: "Failed to load responses" };
  }

  const categoryMap = new Map();

  for (const question of questions) {
    const categoryArray = Array.isArray(question.categories)
      ? question.categories
      : question.categories
        ? [question.categories]
        : [];
    const category = categoryArray[0];
    if (!category) continue;

    const response = responses?.find((r) => r.question_id === question.id);
    if (!response) continue;

    if (!categoryMap.has(category.id)) {
      categoryMap.set(category.id, {
        categoryId: category.id,
        categoryLabel: category.label,
        pillar: category.pillar,
        scores: [],
      });
    }

    categoryMap.get(category.id).scores.push(response.score);
  }

  const categories = Array.from(categoryMap.values()).map((cat) => {
    const avgScore =
      cat.scores.length > 0
        ? cat.scores.reduce((sum, s) => sum + s, 0) / cat.scores.length
        : 0;
    return {
      categoryId: cat.categoryId,
      categoryLabel: cat.categoryLabel,
      pillar: cat.pillar,
      axes: [
        {
          label: cat.categoryLabel,
          score: avgScore,
        },
      ],
    };
  });

  return {
    data: {
      categories,
    },
  };
}

async function debugPrompt() {
  const companyName = process.argv[2] || 'Beyond Weather';
  
  console.log(`\n🔍 Building prompt for: ${companyName}\n`);

  // Find company
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .ilike("name", `%${companyName}%`)
    .maybeSingle();

  if (!company) {
    console.error(`❌ Company "${companyName}" not found`);
    process.exit(1);
  }

  console.log(`✓ Found company: ${company.name} (${company.id})\n`);

  // Get latest assessment
  const { data: latestPeriod } = await supabase
    .from("assessment_periods")
    .select("id, year, quarter")
    .eq("company_id", company.id)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false })
    .limit(1)
    .single();

  if (!latestPeriod) {
    console.error(`❌ No assessments found for ${company.name}`);
    process.exit(1);
  }

  const { year, quarter } = latestPeriod;
  console.log(`✓ Latest assessment: Q${quarter} ${year}\n`);

  // Calculate previous quarter
  let prevYear = year;
  let prevQuarter = quarter - 1;
  if (prevQuarter < 1) {
    prevQuarter = 4;
    prevYear = year - 1;
  }

  // Get previous assessment
  const { data: previousPeriod } = await supabase
    .from("assessment_periods")
    .select("id, year, quarter")
    .eq("company_id", company.id)
    .eq("year", prevYear)
    .eq("quarter", prevQuarter)
    .maybeSingle();

  if (!previousPeriod) {
    console.error(`❌ Previous quarter assessment (Q${prevQuarter} ${prevYear}) not found`);
    process.exit(1);
  }

  console.log(`✓ Previous assessment: Q${prevQuarter} ${prevYear}\n`);

  // Get assessments with scores
  const currentResult = await getAssessmentWithScores(company.id, latestPeriod.id);
  const previousResult = await getAssessmentWithScores(company.id, previousPeriod.id);

  if (currentResult.error || previousResult.error) {
    console.error(`❌ Error loading assessments:`, currentResult.error || previousResult.error);
    process.exit(1);
  }

  // Get monthly reports
  const monthsInQuarter = [];
  if (quarter === 1) monthsInQuarter.push(1, 2, 3);
  else if (quarter === 2) monthsInQuarter.push(4, 5, 6);
  else if (quarter === 3) monthsInQuarter.push(7, 8, 9);
  else monthsInQuarter.push(10, 11, 12);

  const { data: monthlyReports } = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("company_id", company.id)
    .eq("year", year)
    .in("month", monthsInQuarter)
    .order("month", { ascending: true });

  // Format data
  const currentData = formatAssessmentData(currentResult.data.categories);
  const previousData = formatAssessmentData(previousResult.data.categories);
  const reportsData = formatMonthlyReports(monthlyReports || []);

  // Build prompt
  const prompt = buildGeminiPrompt(
    company.name,
    year,
    quarter,
    prevYear,
    prevQuarter,
    currentData,
    previousData,
    reportsData,
  );

  console.log("=".repeat(80));
  console.log("PROMPT:");
  console.log("=".repeat(80));
  console.log(prompt);
  console.log("=".repeat(80));
  console.log(`\n📊 Prompt length: ${prompt.length} characters`);
  console.log(`📊 Estimated tokens: ~${Math.ceil(prompt.length / 4)} tokens\n`);
}

debugPrompt()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

