#!/usr/bin/env node

/**
 * Compare JSON file questions with database questions for a company
 * Usage: node scripts/compare-json-db-questions.mjs "CityLegends" <path-to-json-file>
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

function normalizeText(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]/g, '')
    .replace(/['"]/g, '');
}

async function compareQuestions() {
  const companyName = process.argv[2] || 'CityLegends';
  const jsonPath = process.argv[3];

  if (!jsonPath) {
    console.error('Usage: node scripts/compare-json-db-questions.mjs "CityLegends" <path-to-json-file>');
    process.exit(1);
  }

  if (!fs.existsSync(jsonPath)) {
    console.error(`JSON file not found: ${jsonPath}`);
    process.exit(1);
  }

  console.log(`\n🔍 Comparing JSON with Database for: ${companyName}\n`);
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

  // Load JSON file
  let jsonData;
  try {
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    jsonData = JSON.parse(jsonContent);
  } catch (error) {
    console.error('Failed to parse JSON:', error.message);
    process.exit(1);
  }

  // Extract all statements from JSON
  const jsonStatements = new Map(); // normalized -> { statement, pillar, category }
  for (const [pillar, categories] of Object.entries(jsonData)) {
    if (typeof categories !== 'object' || categories === null) continue;
    for (const [categoryName, statements] of Object.entries(categories)) {
      if (!Array.isArray(statements)) continue;
      statements.forEach((item) => {
        const statement = typeof item === 'string' ? item : item.statement || item.prompt || '';
        if (statement) {
          const normalized = normalizeText(statement);
          jsonStatements.set(normalized, {
            statement,
            pillar,
            category: categoryName,
          });
        }
      });
    }
  }

  console.log(`📄 JSON File: ${jsonStatements.size} statements found\n`);

  // Get database questions
  const { data: dbQuestions } = await supabase
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

  console.log(`💾 Database: ${dbQuestions?.length || 0} questions found\n`);

  // Normalize database questions
  const dbQuestionMap = new Map(); // normalized -> question object
  dbQuestions?.forEach((q) => {
    const normalized = normalizeText(q.prompt);
    const cat = Array.isArray(q.categories) ? q.categories[0] : q.categories;
    dbQuestionMap.set(normalized, {
      id: q.id,
      prompt: q.prompt,
      sequence: q.sequence,
      category: cat?.label,
      pillar: cat?.pillar,
    });
  });

  // Find matches and mismatches
  const matched = [];
  const jsonOnly = [];
  const dbOnly = [];

  // Check JSON statements against DB
  jsonStatements.forEach((jsonItem, normalized) => {
    if (dbQuestionMap.has(normalized)) {
      matched.push({
        json: jsonItem,
        db: dbQuestionMap.get(normalized),
      });
    } else {
      jsonOnly.push(jsonItem);
    }
  });

  // Check DB questions against JSON
  dbQuestionMap.forEach((dbItem, normalized) => {
    if (!jsonStatements.has(normalized)) {
      dbOnly.push(dbItem);
    }
  });

  console.log('📊 COMPARISON RESULTS:');
  console.log('='.repeat(80));
  console.log(`✅ Matched: ${matched.length}`);
  console.log(`📄 In JSON only: ${jsonOnly.length}`);
  console.log(`💾 In DB only: ${dbOnly.length}\n`);

  if (jsonOnly.length > 0) {
    console.log('\n❌ STATEMENTS IN JSON BUT NOT IN DATABASE:');
    console.log('-'.repeat(80));
    jsonOnly.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.pillar} > ${item.category}`);
      console.log(`   "${item.statement.substring(0, 80)}${item.statement.length > 80 ? '...' : ''}"`);
    });
  }

  if (dbOnly.length > 0) {
    console.log('\n⚠️  QUESTIONS IN DATABASE BUT NOT IN JSON:');
    console.log('-'.repeat(80));
    dbOnly.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.pillar} > ${item.category} (Q${item.sequence})`);
      console.log(`   "${item.prompt.substring(0, 80)}${item.prompt.length > 80 ? '...' : ''}"`);
      console.log(`   Question ID: ${item.id}`);
    });
  }

  // Show potential normalization mismatches
  console.log('\n🔍 POTENTIAL TEXT MISMATCHES (similar but not exact):');
  console.log('-'.repeat(80));
  let foundSimilar = false;
  
  jsonOnly.forEach((jsonItem) => {
    const jsonWords = normalizeText(jsonItem.statement).split(' ');
    const similar = [];
    
    dbQuestionMap.forEach((dbItem) => {
      const dbWords = normalizeText(dbItem.prompt).split(' ');
      const commonWords = jsonWords.filter(w => dbWords.includes(w));
      const similarity = commonWords.length / Math.max(jsonWords.length, dbWords.length);
      
      if (similarity > 0.7 && similarity < 1.0) {
        similar.push({ dbItem, similarity });
      }
    });
    
    if (similar.length > 0) {
      foundSimilar = true;
      console.log(`\nJSON: "${jsonItem.statement.substring(0, 70)}..."`);
      similar.sort((a, b) => b.similarity - a.similarity);
      similar.slice(0, 3).forEach(({ dbItem, similarity }) => {
        console.log(`  ${(similarity * 100).toFixed(0)}% similar: "${dbItem.prompt.substring(0, 70)}..."`);
      });
    }
  });

  if (!foundSimilar) {
    console.log('None found');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Comparison complete\n');
  
  if (dbOnly.length > 0) {
    console.log('💡 RECOMMENDATION:');
    console.log(`   The database has ${dbOnly.length} questions that aren't in your JSON file.`);
    console.log('   These questions won\'t have responses after import.');
    console.log('   Either:');
    console.log('   1. Add these questions to your JSON file, OR');
    console.log('   2. Delete these questions from the database before importing\n');
  }
}

compareQuestions().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
