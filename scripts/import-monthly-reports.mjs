import fs from "node:fs";
import path from "path";
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

// Month name to number mapping
const monthMap = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
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

  // Try exact match first
  const { data: exactMatch } = await supabase
    .from("companies")
    .select("id, name")
    .ilike("name", cleaned)
    .maybeSingle();

  if (exactMatch) {
    return exactMatch;
  }

  // Try partial match (company name might have variations)
  const { data: partialMatches } = await supabase
    .from("companies")
    .select("id, name")
    .ilike("name", `%${cleaned}%`)
    .limit(5);

  if (partialMatches && partialMatches.length > 0) {
    // Return the first match (you might want to add manual matching logic here)
    console.log(`  ⚠️  Found partial match for "${companyName}": ${partialMatches[0].name}`);
    return partialMatches[0];
  }

  return null;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    const nextChar = j < line.length - 1 ? line[j + 1] : null;
    
    if (char === '"') {
      // Handle escaped quotes ("")
      if (nextChar === '"' && inQuotes) {
        current += '"';
        j++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim()); // Add last value
  
  return values;
}

function parseCSV(csvContent) {
  // Handle different line endings
  const lines = csvContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(line => line.trim());
    
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  // Parse header
  const headerValues = parseCSVLine(lines[0]);
  const headers = headerValues.map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Find column indices
  const colIndex = {
    timestamp: headers.findIndex(h => h.toLowerCase().includes('timestamp')),
    email: headers.findIndex(h => h.toLowerCase().includes('email')),
    company: headers.findIndex(h => h.toLowerCase().includes('company')),
    month: headers.findIndex(h => h.toLowerCase().includes('month')),
    year: headers.findIndex(h => h.toLowerCase().includes('year')),
    challengeTeam: headers.findIndex(h => h.toLowerCase().includes('challenge team') || h.toLowerCase().includes('major challenge team')),
    challengeProduct: headers.findIndex(h => h.toLowerCase().includes('challenge product') || h.toLowerCase().includes('major challenge product')),
    challengeSales: headers.findIndex(h => h.toLowerCase().includes('challenge sales') || h.toLowerCase().includes('major challenge sales')),
    challengeMarketing: headers.findIndex(h => h.toLowerCase().includes('challenge marketing') || h.toLowerCase().includes('major challenge marketing')),
    challengeFinance: headers.findIndex(h => h.toLowerCase().includes('challenge finance') || h.toLowerCase().includes('major challenge finance')),
    challengeFundraise: headers.findIndex(h => h.toLowerCase().includes('challenge fundraise') || h.toLowerCase().includes('major challenge fundraise')),
  };

  // Validate required columns
  const requiredCols = ['company', 'month', 'year'];
  for (const col of requiredCols) {
    if (colIndex[col] === -1) {
      throw new Error(`Missing required column: ${col}`);
    }
  }

  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Ensure we have enough columns
    if (values.length < headers.length) {
      // Pad with empty strings if needed
      while (values.length < headers.length) {
        values.push('');
      }
    }

    // Extract values
    const getValue = (idx) => {
      if (idx === -1 || idx >= values.length) return null;
      const val = values[idx];
      // Remove quotes and check if it's empty or just TRUE/FALSE
      const cleaned = val.trim().replace(/^"|"$/g, '');
      return cleaned && cleaned !== '' && cleaned !== 'TRUE' && cleaned !== 'FALSE' ? cleaned : null;
    };

    const company = getValue(colIndex.company);
    const month = getValue(colIndex.month);
    const year = getValue(colIndex.year);

    // Skip rows without required data
    if (!company || !month || !year) {
      continue;
    }

    rows.push({
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

  return rows;
}

async function importMonthlyReports(csvFilePath) {
  console.log(`Reading CSV file: ${csvFilePath}`);
  const csvContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
  
  const rows = parseCSV(csvContent);
  console.log(`Parsed ${rows.length} rows from CSV`);

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
}

// Main execution
const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.error('Usage: node scripts/import-monthly-reports.mjs <path-to-csv-file>');
  console.error('\nTo export from Google Sheets:');
  console.error('1. Open the Google Sheet');
  console.error('2. File > Download > Comma-separated values (.csv)');
  console.error('3. Run: node scripts/import-monthly-reports.mjs path/to/file.csv');
  process.exit(1);
}

if (!fs.existsSync(csvFilePath)) {
  console.error(`Error: File not found: ${csvFilePath}`);
  process.exit(1);
}

importMonthlyReports(csvFilePath)
  .then(() => {
    console.log('\nImport completed!');
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });

