#!/usr/bin/env node

/**
 * Detailed debug script for CityLegends to find missing responses
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
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

async function debugDetailed() {
  console.log('\n🔍 DETAILED DEBUG: CityLegends\n');
  
  // Get company
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', 'CityLegends')
    .single();

  if (!company) {
    console.error('Company not found');
    process.exit(1);
  }

  // Get period
  const { data: periods } = await supabase
    .from('assessment_periods')
    .select('id, year, quarter')
    .eq('company_id', company.id)
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
    .limit(1);

  if (!periods || periods.length === 0) {
    console.error('No periods found');
    process.exit(1);
  }

  const period = periods[0];
  console.log(`Period: Q${period.quarter} ${period.year} (${period.id})\n`);

  // Get questions
  const { data: questions } = await supabase
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
    .eq('company_id', company.id)
    .order('sequence');

  console.log(`Total questions: ${questions?.length || 0}\n`);

  // Get responses
  const { data: responses } = await supabase
    .from('assessment_responses')
    .select('question_id, score')
    .eq('assessment_period_id', period.id);

  console.log(`Total responses: ${responses?.length || 0}\n`);

  // Find questions without responses
  const questionIds = new Set(questions?.map(q => q.id) || []);
  const responseQuestionIds = new Set(responses?.map(r => r.question_id) || []);
  
  const missingResponses = questions?.filter(q => !responseQuestionIds.has(q.id)) || [];
  const extraResponses = responses?.filter(r => !questionIds.has(r.question_id)) || [];

  console.log('❌ QUESTIONS WITHOUT RESPONSES:');
  console.log('='.repeat(80));
  if (missingResponses.length === 0) {
    console.log('None - all questions have responses\n');
  } else {
    console.log(`Found ${missingResponses.length} questions without responses:\n`);
    missingResponses.forEach((q) => {
      const cat = Array.isArray(q.categories) ? q.categories[0] : q.categories;
      console.log(`  Q${q.sequence}: ${q.prompt.substring(0, 70)}...`);
      console.log(`    Category: ${cat?.pillar} > ${cat?.label}`);
      console.log(`    Question ID: ${q.id}\n`);
    });
  }

  console.log('\n⚠️  RESPONSES WITHOUT MATCHING QUESTIONS:');
  console.log('='.repeat(80));
  if (extraResponses.length === 0) {
    console.log('None - all responses match questions\n');
  } else {
    console.log(`Found ${extraResponses.length} responses without matching questions:\n`);
    extraResponses.forEach((r) => {
      console.log(`  Question ID: ${r.question_id}, Score: ${r.score}`);
    });
  }

  // Check for duplicate responses
  console.log('\n🔄 DUPLICATE RESPONSES:');
  console.log('='.repeat(80));
  const responseMap = new Map();
  responses?.forEach((r) => {
    if (!responseMap.has(r.question_id)) {
      responseMap.set(r.question_id, []);
    }
    responseMap.get(r.question_id).push(r.score);
  });

  const duplicates = Array.from(responseMap.entries()).filter(([_, scores]) => scores.length > 1);
  if (duplicates.length === 0) {
    console.log('None - no duplicate responses\n');
  } else {
    console.log(`Found ${duplicates.length} questions with multiple responses:\n`);
    duplicates.forEach(([questionId, scores]) => {
      const question = questions?.find(q => q.id === questionId);
      const cat = question ? (Array.isArray(question.categories) ? question.categories[0] : question.categories) : null;
      console.log(`  Q${question?.sequence || '?'}: ${question?.prompt.substring(0, 60) || 'Unknown'}...`);
      console.log(`    Category: ${cat?.pillar || '?'} > ${cat?.label || '?'}`);
      console.log(`    Scores: [${scores.join(', ')}]`);
      console.log(`    Question ID: ${questionId}\n`);
    });
  }

  // Show zero scores
  console.log('\n📊 RESPONSES WITH ZERO SCORES:');
  console.log('='.repeat(80));
  const zeroResponses = responses?.filter(r => r.score === 0) || [];
  console.log(`Found ${zeroResponses.length} responses with score 0 (${((zeroResponses.length / (responses?.length || 1)) * 100).toFixed(1)}%)\n`);

  // Group by category and show score distribution
  console.log('\n📈 SCORE DISTRIBUTION BY CATEGORY:');
  console.log('='.repeat(80));
  const categoryMap = new Map();
  
  questions?.forEach((q) => {
    const cat = Array.isArray(q.categories) ? q.categories[0] : q.categories;
    if (!cat) return;

    const response = responses?.find(r => r.question_id === q.id);
    const score = response?.score ?? null;

    if (!categoryMap.has(cat.id)) {
      categoryMap.set(cat.id, {
        label: cat.label,
        pillar: cat.pillar,
        questions: [],
        scores: [],
        zeroCount: 0,
      });
    }

    const catData = categoryMap.get(cat.id);
    catData.questions.push({
      id: q.id,
      sequence: q.sequence,
      score,
    });
    
    if (score !== null) {
      catData.scores.push(score);
      if (score === 0) {
        catData.zeroCount++;
      }
    }
  });

  categoryMap.forEach((cat, catId) => {
    const avg = cat.scores.length > 0 
      ? cat.scores.reduce((sum, s) => sum + s, 0) / cat.scores.length 
      : 0;
    const answered = cat.scores.length;
    const total = cat.questions.length;
    const missing = total - answered;
    
    console.log(`\n${cat.pillar} > ${cat.label}:`);
    console.log(`  Questions: ${total}, Answered: ${answered}, Missing: ${missing}`);
    console.log(`  Zero scores: ${cat.zeroCount} (${answered > 0 ? ((cat.zeroCount / answered) * 100).toFixed(1) : 0}%)`);
    console.log(`  Average score: ${avg.toFixed(2)}`);
    if (cat.scores.length > 0) {
      console.log(`  Score range: ${Math.min(...cat.scores)} - ${Math.max(...cat.scores)}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Detailed debug complete\n');
}

debugDetailed().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
