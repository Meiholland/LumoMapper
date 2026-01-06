#!/usr/bin/env node

/**
 * Clean company names in the database by removing emojis and special characters
 * Usage: node scripts/clean-company-names.mjs [--dry-run]
 * 
 * Use --dry-run to see what would be changed without actually updating the database
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

function cleanCompanyName(companyName) {
  if (!companyName) return null;
  // Remove emojis and special Unicode characters, but keep letters, numbers, spaces, &, -, ., and @
  return companyName
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emoji range
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // Miscellaneous symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // Variation selectors
    .replace(/[\u{200D}]/gu, '') // Zero-width joiner
    .replace(/[^\w\s&.\-@]/g, '') // Remove any remaining special chars except allowed ones
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim();
}

async function cleanCompanyNames(dryRun = false) {
  console.log('🔍 Fetching all companies...\n');

  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch companies: ${error.message}`);
  }

  if (!companies || companies.length === 0) {
    console.log('No companies found.');
    return;
  }

  console.log(`Found ${companies.length} companies\n`);

  const changes = [];
  const noChanges = [];

  for (const company of companies) {
    const cleaned = cleanCompanyName(company.name);
    
    if (cleaned !== company.name) {
      changes.push({
        id: company.id,
        original: company.name,
        cleaned: cleaned,
      });
    } else {
      noChanges.push(company.name);
    }
  }

  if (changes.length === 0) {
    console.log('✅ All company names are already clean!\n');
    return;
  }

  console.log(`📝 Found ${changes.length} companies with emojis/special characters:\n`);

  for (const change of changes) {
    console.log(`  "${change.original}"`);
    console.log(`  → "${change.cleaned}"\n`);
  }

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes made to database');
    console.log(`Would update ${changes.length} companies\n`);
    return;
  }

  console.log(`\n🔄 Updating ${changes.length} companies...\n`);

  let updated = 0;
  let errors = 0;

  for (const change of changes) {
    const { error: updateError } = await supabase
      .from('companies')
      .update({ name: change.cleaned })
      .eq('id', change.id);

    if (updateError) {
      console.error(`  ❌ Error updating "${change.original}":`, updateError.message);
      errors++;
    } else {
      console.log(`  ✓ Updated: "${change.original}" → "${change.cleaned}"`);
      updated++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`No changes needed: ${noChanges.length}`);
  console.log('\n✅ Company name cleaning completed!');
}

const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  console.log('🔍 Running in DRY RUN mode - no changes will be made\n');
}

cleanCompanyNames(dryRun)
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

