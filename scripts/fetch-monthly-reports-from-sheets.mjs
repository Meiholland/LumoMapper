#!/usr/bin/env node

/**
 * Fetch monthly reports from Google Sheets and import to database
 * Usage: node scripts/fetch-monthly-reports-from-sheets.mjs
 * 
 * Requires:
 * - GOOGLE_SHEETS_SPREADSHEET_ID env variable
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL env variable  
 * - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env variable (or path to JSON key file)
 */

import { google } from 'googleapis';
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
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1yHpgE3k4d4KEdhk2Jhja6Ym4R1gFGlEJTU5Op9R5geQ';
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

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

// Month name to number mapping
const monthMap = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseMonth(monthStr) {
  if (!monthStr) return null;
  const normalized = monthStr.trim().toLowerCase();
  return monthMap[normalized] || null;
}

function parseYear(yearStr) {
  if (!yearStr) return null;
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 2000 || year > 2100) return null;
  return year;
}

function cleanCompanyName(companyName) {
  if (!companyName) return null;
  // Remove emojis and special Unicode characters, but keep letters, numbers, spaces, &, -, ., and @
  // This handles emojis like 💊, 🌍, 💖, 🌆, 🧘, 🏞️, ⚛️, 🎤, etc.
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

async function getOrFindCompany(companyName) {
  const cleaned = cleanCompanyName(companyName);
  if (!cleaned) return null;

  // First try exact match with cleaned name
  const { data: exactMatch } = await supabase
    .from("companies")
    .select("id, name")
    .ilike("name", cleaned)
    .maybeSingle();

  if (exactMatch) return exactMatch;

  // Try matching cleaned name against cleaned database names
  // Fetch all companies and compare cleaned names
  const { data: allCompanies } = await supabase
    .from("companies")
    .select("id, name");

  if (allCompanies) {
    // Find exact match by comparing cleaned names
    const exactCleanedMatch = allCompanies.find(
      (c) => cleanCompanyName(c.name)?.toLowerCase() === cleaned.toLowerCase()
    );
    if (exactCleanedMatch) {
      return exactCleanedMatch;
    }

    // Find partial match by comparing cleaned names
    const partialCleanedMatch = allCompanies.find(
      (c) => {
        const dbCleaned = cleanCompanyName(c.name);
        return dbCleaned && (
          dbCleaned.toLowerCase().includes(cleaned.toLowerCase()) ||
          cleaned.toLowerCase().includes(dbCleaned.toLowerCase())
        );
      }
    );
    if (partialCleanedMatch) {
      console.log(`  ⚠️  Found partial match for "${companyName}": ${partialCleanedMatch.name}`);
      return partialCleanedMatch;
    }
  }

  // Fallback: try SQL partial match
  const { data: partialMatches } = await supabase
    .from("companies")
    .select("id, name")
    .ilike("name", `%${cleaned}%`)
    .limit(5);

  if (partialMatches && partialMatches.length > 0) {
    console.log(`  ⚠️  Found SQL partial match for "${companyName}": ${partialMatches[0].name}`);
    return partialMatches[0];
  }

  return null;
}

async function getGoogleSheetsClient() {
  let credentials;
  
  // Option 1: Use JSON key file path
  if (serviceAccountKeyPath && fs.existsSync(serviceAccountKeyPath)) {
    credentials = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf-8'));
  }
  // Option 2: Use environment variables
  else if (serviceAccountEmail && serviceAccountKey) {
    credentials = {
      client_email: serviceAccountEmail,
      private_key: serviceAccountKey.replace(/\\n/g, '\n'),
    };
  }
  // Option 3: Try to find key file in common locations
  else {
    const possiblePaths = [
      path.resolve(__dirname, '..', 'google-service-account-key.json'),
      path.resolve(__dirname, '..', 'google-credentials.json'),
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
    ].filter(Boolean);

    for (const keyPath of possiblePaths) {
      if (fs.existsSync(keyPath)) {
        credentials = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
        break;
      }
    }
  }

  if (!credentials) {
    throw new Error(
      'Google Service Account credentials not found. ' +
      'Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    );
  }

  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );

  return google.sheets({ version: 'v4', auth });
}

async function fetchSheetData() {
  const sheets = await getGoogleSheetsClient();
  
  console.log(`📊 Fetching data from Google Sheet: ${spreadsheetId}`);
  
  // Fetch all data from the first sheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'A:Z', // Fetch all columns A-Z
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    throw new Error('Sheet appears to be empty or has no data rows');
  }

  // Parse header row
  const headers = rows[0].map(h => h.trim().toLowerCase());
  
  const colIndex = {
    timestamp: headers.findIndex(h => h.includes('timestamp')),
    email: headers.findIndex(h => h.includes('email')),
    company: headers.findIndex(h => h.includes('company')),
    month: headers.findIndex(h => h.includes('month')),
    year: headers.findIndex(h => h.includes('year')),
    challengeTeam: headers.findIndex(h => h.includes('challenge team') || h.includes('major challenge team')),
    challengeProduct: headers.findIndex(h => h.includes('challenge product') || h.includes('major challenge product')),
    challengeSales: headers.findIndex(h => h.includes('challenge sales') || h.includes('major challenge sales')),
    challengeMarketing: headers.findIndex(h => h.includes('challenge marketing') || h.includes('major challenge marketing')),
    challengeFinance: headers.findIndex(h => h.includes('challenge finance') || h.includes('major challenge finance')),
    challengeFundraise: headers.findIndex(h => h.includes('challenge fundraise') || h.includes('major challenge fundraise')),
  };

  // Validate required columns
  if (colIndex.company === -1 || colIndex.month === -1 || colIndex.year === -1) {
    throw new Error('Missing required columns: Company, Month, or Year');
  }

  // Parse data rows
  const dataRows = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    const getValue = (idx) => {
      if (idx === -1 || idx >= row.length) return null;
      const val = row[idx];
      return val && val !== '' && val !== 'TRUE' && val !== 'FALSE' ? String(val).trim() : null;
    };

    const company = getValue(colIndex.company);
    const month = getValue(colIndex.month);
    const year = getValue(colIndex.year);

    if (!company || !month || !year) continue;

    dataRows.push({
      company,
      month: parseMonth(month),
      year: parseYear(year),
      challengeTeam: getValue(colIndex.challengeTeam),
      challengeProduct: getValue(colIndex.challengeProduct),
      challengeSales: getValue(colIndex.challengeSales),
      challengeMarketing: getValue(colIndex.challengeMarketing),
      challengeFinance: getValue(colIndex.challengeFinance),
      challengeFundraise: getValue(colIndex.challengeFundraise),
    });
  }

  return dataRows;
}

async function importMonthlyReports() {
  console.log('🚀 Starting monthly reports import from Google Sheets...\n');

  const rows = await fetchSheetData();
  console.log(`✓ Fetched ${rows.length} rows from Google Sheets\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    if (!row.month || !row.year) {
      console.log(`  ⚠️  Skipping row: Invalid month/year for ${row.company}`);
      skipped++;
      continue;
    }

    const company = await getOrFindCompany(row.company);
    if (!company) {
      console.log(`  ❌ Company not found: "${row.company}"`);
      skipped++;
      continue;
    }

    try {
      const { error } = await supabase
        .from("monthly_reports")
        .upsert(
          {
            company_id: company.id,
            month: row.month,
            year: row.year,
            challenge_team: row.challengeTeam || null,
            challenge_product: row.challengeProduct || null,
            challenge_sales: row.challengeSales || null,
            challenge_marketing: row.challengeMarketing || null,
            challenge_finance: row.challengeFinance || null,
            challenge_fundraise: row.challengeFundraise || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id,year,month" }
        );

      if (error) {
        console.error(`  ❌ Error importing ${company.name} ${row.month}/${row.year}:`, error.message);
        errors++;
      } else {
        console.log(`  ✓ Imported ${company.name} - ${row.month}/${row.year}`);
        imported++;
      }
    } catch (err) {
      console.error(`  ❌ Unexpected error for ${company.name}:`, err.message);
      errors++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log('\n✅ Import completed!');
}

importMonthlyReports()
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });

