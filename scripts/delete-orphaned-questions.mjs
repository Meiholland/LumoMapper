#!/usr/bin/env node

/**
 * Delete questions that have no responses for a company
 * Usage: node scripts/delete-orphaned-questions.mjs "CityLegends"
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

async function deleteOrphanedQuestions() {
  const companyName = process.argv[2] || 'CityLegends';

  console.log(`\n🗑️  Finding orphaned questions for: ${companyName}\n`);
  console.log('='.repeat(80));

  // Get company
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', companyName)
    .single();

  if (!company) {
    console.error('Company not found');
    process.exit(1);
  }

  console.log(`Company ID: ${company.id}\n`);

  // Get all questions for this company
  const { data: questions } = await supabase
    .from('questions')
    .select(`
      id,
      prompt,
      sequence,
      categories (
        id,
        label,
        pillar
      )
    `)
    .eq('company_id', company.id)
    .order('sequence');

  if (!questions || questions.length === 0) {
    console.log('No questions found for this company');
    process.exit(0);
  }

  console.log(`Found ${questions.length} questions\n`);

  // Get all assessment periods for this company
  const { data: periods } = await supabase
    .from('assessment_periods')
    .select('id')
    .eq('company_id', company.id);

  const periodIds = periods?.map(p => p.id) || [];

  if (periodIds.length === 0) {
    console.log('No assessment periods found. All questions are orphaned.');
    console.log('⚠️  This will delete ALL questions. Are you sure?');
    console.log('   (This script requires at least one assessment period to determine orphaned questions)');
    process.exit(1);
  }

  // Get all responses for this company
  const { data: responses } = await supabase
    .from('assessment_responses')
    .select('question_id')
    .in('assessment_period_id', periodIds);

  const responseQuestionIds = new Set(responses?.map(r => r.question_id) || []);

  // Find orphaned questions (questions without any responses)
  const orphanedQuestions = questions.filter(q => !responseQuestionIds.has(q.id));

  if (orphanedQuestions.length === 0) {
    console.log('✅ No orphaned questions found. All questions have responses.\n');
    process.exit(0);
  }

  console.log(`⚠️  Found ${orphanedQuestions.length} orphaned questions:\n`);
  orphanedQuestions.forEach((q, i) => {
    const cat = Array.isArray(q.categories) ? q.categories[0] : q.categories;
    console.log(`${i + 1}. ${cat?.pillar || '?'} > ${cat?.label || '?'} (Q${q.sequence})`);
    console.log(`   "${q.prompt.substring(0, 70)}${q.prompt.length > 70 ? '...' : ''}"`);
    console.log(`   Question ID: ${q.id}\n`);
  });

  console.log('='.repeat(80));
  console.log(`\n⚠️  WARNING: This will delete ${orphanedQuestions.length} questions permanently!`);
  console.log('   These questions have no responses and are likely duplicates or unused.\n');

  // In a real scenario, you'd want user confirmation, but for a script we'll proceed
  // For safety, let's require explicit confirmation via environment variable
  if (process.env.CONFIRM_DELETE !== 'true') {
    console.log('To delete these questions, run:');
    console.log(`CONFIRM_DELETE=true npm run delete:orphaned "${companyName}"\n`);
    process.exit(0);
  }

  console.log('Deleting orphaned questions...\n');

  const questionIds = orphanedQuestions.map(q => q.id);
  const { error: deleteError } = await supabase
    .from('questions')
    .delete()
    .in('id', questionIds);

  if (deleteError) {
    console.error('❌ Error deleting questions:', deleteError.message);
    process.exit(1);
  }

  console.log(`✅ Successfully deleted ${orphanedQuestions.length} orphaned questions\n`);
}

deleteOrphanedQuestions().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
