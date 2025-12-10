#!/usr/bin/env node

/**
 * Debug script to inspect raw assessment data for a company
 * Usage: node scripts/debug-company-data.mjs "CityLegends"
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists (same as grant-admin.mjs)
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
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

const companyName = process.argv[2] || 'CityLegends';

async function debugCompanyData() {
  console.log(`\n🔍 Debugging data for: ${companyName}\n`);
  console.log('='.repeat(80));

  // 1. Find the company
  console.log('\n1️⃣ COMPANY INFO');
  console.log('-'.repeat(80));
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', companyName)
    .single();

  if (companyError || !company) {
    console.error('❌ Company not found:', companyError?.message);
    process.exit(1);
  }

  console.log('Company ID:', company.id);
  console.log('Company Name:', company.name);

  // 2. Get all assessment periods
  console.log('\n2️⃣ ASSESSMENT PERIODS');
  console.log('-'.repeat(80));
  const { data: periods, error: periodsError } = await supabase
    .from('assessment_periods')
    .select('id, year, quarter, submitted_at, submitted_by')
    .eq('company_id', company.id)
    .order('year', { ascending: false })
    .order('quarter', { ascending: false });

  if (periodsError) {
    console.error('❌ Error fetching periods:', periodsError.message);
    process.exit(1);
  }

  console.log(`Found ${periods?.length || 0} assessment periods:`);
  periods?.forEach((p, i) => {
    console.log(`  ${i + 1}. Q${p.quarter} ${p.year} (ID: ${p.id})`);
    console.log(`     Submitted: ${p.submitted_at || 'Not submitted'}`);
  });

  if (!periods || periods.length === 0) {
    console.log('⚠️  No assessment periods found');
    process.exit(0);
  }

  // 3. Check for company-specific questions
  console.log('\n3️⃣ QUESTIONS');
  console.log('-'.repeat(80));
  const { data: companyQuestions } = await supabase
    .from('questions')
    .select('id')
    .eq('company_id', company.id)
    .limit(1);

  const hasCompanyQuestions = companyQuestions && companyQuestions.length > 0;
  console.log(`Company-specific questions: ${hasCompanyQuestions ? 'YES' : 'NO'}`);

  // Fetch questions (company-specific or standard)
  const questionsQuery = supabase
    .from('questions')
    .select(`
      id,
      prompt,
      sequence,
      category_id,
      categories (
        id,
        label,
        pillar
      )
    `)
    .order('sequence');

  if (hasCompanyQuestions) {
    questionsQuery.eq('company_id', company.id);
    console.log('Using company-specific questions');
  } else {
    questionsQuery.is('company_id', null);
    console.log('Using standard questions');
  }

  const { data: questions, error: questionsError } = await questionsQuery;

  if (questionsError || !questions) {
    console.error('❌ Error fetching questions:', questionsError?.message);
    process.exit(1);
  }

  console.log(`Found ${questions.length} questions`);
  console.log('\nQuestions by category:');
  const categoryMap = new Map();
  questions.forEach((q) => {
    const cat = Array.isArray(q.categories) ? q.categories[0] : q.categories;
    if (cat) {
      if (!categoryMap.has(cat.id)) {
        categoryMap.set(cat.id, {
          label: cat.label,
          pillar: cat.pillar,
          questions: [],
        });
      }
      categoryMap.get(cat.id).questions.push({
        id: q.id,
        sequence: q.sequence,
        prompt: q.prompt.substring(0, 60) + '...',
      });
    }
  });

  categoryMap.forEach((cat, catId) => {
    console.log(`\n  📊 ${cat.pillar} > ${cat.label} (${cat.questions.length} questions)`);
    cat.questions.forEach((q) => {
      console.log(`     Q${q.sequence}: ${q.prompt}`);
    });
  });

  // 4. Get all responses for all periods
  console.log('\n4️⃣ RESPONSES');
  console.log('-'.repeat(80));
  const periodIds = periods.map((p) => p.id);
  const { data: responses, error: responsesError } = await supabase
    .from('assessment_responses')
    .select('assessment_period_id, question_id, score, comment')
    .in('assessment_period_id', periodIds)
    .order('question_id');

  if (responsesError) {
    console.error('❌ Error fetching responses:', responsesError.message);
    process.exit(1);
  }

  console.log(`Found ${responses?.length || 0} total responses\n`);

  // Group responses by period
  periods.forEach((period) => {
    const periodResponses = responses?.filter(
      (r) => r.assessment_period_id === period.id,
    ) || [];

    console.log(`\n  📅 Q${period.quarter} ${period.year} (${periodResponses.length} responses):`);
    
    if (periodResponses.length === 0) {
      console.log('     ⚠️  No responses found for this period');
      return;
    }

    // Group by category
    const periodCategoryMap = new Map();
    periodResponses.forEach((response) => {
      const question = questions.find((q) => q.id === response.question_id);
      if (!question) {
        console.log(`     ⚠️  Question ${response.question_id} not found in questions list`);
        return;
      }

      const cat = Array.isArray(question.categories) 
        ? question.categories[0] 
        : question.categories;
      if (!cat) return;

      if (!periodCategoryMap.has(cat.id)) {
        periodCategoryMap.set(cat.id, {
          label: cat.label,
          pillar: cat.pillar,
          scores: [],
        });
      }
      periodCategoryMap.get(cat.id).scores.push(response.score);
    });

    periodCategoryMap.forEach((cat, catId) => {
      const avg = cat.scores.reduce((sum, s) => sum + s, 0) / cat.scores.length;
      const min = Math.min(...cat.scores);
      const max = Math.max(...cat.scores);
      console.log(`     ${cat.pillar} > ${cat.label}:`);
      console.log(`        Scores: [${cat.scores.join(', ')}]`);
      console.log(`        Average: ${avg.toFixed(2)}, Min: ${min}, Max: ${max}`);
    });
  });

  // 5. Show what the aggregation logic would produce
  console.log('\n5️⃣ EXPECTED AGGREGATION (what the chart should show)');
  console.log('-'.repeat(80));

  periods.forEach((period) => {
    const periodResponses = responses?.filter(
      (r) => r.assessment_period_id === period.id,
    ) || [];

    if (periodResponses.length === 0) {
      console.log(`\n  Q${period.quarter} ${period.year}: No data`);
      return;
    }

    console.log(`\n  Q${period.quarter} ${period.year}:`);

    // Build category map like the code does
    const categoryMap = new Map();
    questions.forEach((question) => {
      const catArray = Array.isArray(question.categories) 
        ? question.categories 
        : question.categories 
          ? [question.categories] 
          : [];
      const category = catArray[0];
      if (!category) return;

      const response = periodResponses.find(
        (r) => r.question_id === question.id,
      );
      if (!response) return;

      if (!categoryMap.has(category.id)) {
        categoryMap.set(category.id, {
          categoryId: category.id,
          categoryLabel: category.label,
          pillar: category.pillar,
          scores: [],
        });
      }
      categoryMap.get(category.id).scores.push(response.score);
    });

    // Group by pillar
    const pillarMap = new Map();
    categoryMap.forEach((cat) => {
      if (!pillarMap.has(cat.pillar)) {
        pillarMap.set(cat.pillar, []);
      }
      const avgScore = cat.scores.reduce((sum, s) => sum + s, 0) / cat.scores.length;
      pillarMap.get(cat.pillar).push({
        label: cat.categoryLabel,
        score: avgScore,
      });
    });

    pillarMap.forEach((categories, pillar) => {
      console.log(`\n    ${pillar}:`);
      categories.forEach((cat) => {
        console.log(`      ${cat.label}: ${cat.score.toFixed(2)}`);
      });
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Debug complete\n');
}

debugCompanyData().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
