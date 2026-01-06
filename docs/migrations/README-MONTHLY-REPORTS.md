# Monthly Reports Migration & Import Guide

This guide explains how to set up the monthly reports table and import data from Google Sheets.

## Step 1: Run Database Migrations

Run these migrations in your Supabase SQL editor (in order):

1. `006-add-monthly-reports.sql` - Creates the monthly_reports table
2. `007-add-monthly-reports-rls.sql` - Adds Row Level Security policies

### Using Supabase Dashboard:
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file
4. Run each migration in order

## Step 2: Export Google Sheets Data

1. Open the Google Sheet: https://docs.google.com/spreadsheets/d/1yHpgE3k4d4KEdhk2Jhja6Ym4R1gFGlEJTU5Op9R5geQ/edit
2. Go to **File** → **Download** → **Comma-separated values (.csv)**
3. Save the file to your project directory (e.g., `monthly-reports.csv`)

## Step 3: Import Data

Make sure your `.env.local` file has the required Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then run the import script:

```bash
npm run import:reports monthly-reports.csv
```

Or directly:

```bash
node scripts/import-monthly-reports.mjs monthly-reports.csv
```

## What the Script Does

1. **Parses the CSV file** - Handles quoted fields, commas within fields, etc.
2. **Matches companies** - Tries to match company names from the CSV to companies in your database
   - First tries exact match (case-insensitive)
   - Then tries partial match
   - Logs warnings for partial matches
3. **Imports data** - Upserts monthly reports (updates if exists, inserts if new)
4. **Reports results** - Shows how many records were imported, skipped, or had errors

## Company Name Matching

The script cleans company names by removing emojis and special characters. If a company name doesn't match exactly, the script will:
- Try partial matching
- Log a warning so you can verify the match
- Skip the record if no match is found

### Common Issues

**Company name mismatch:**
- The CSV might have "Healthplus.ai 💊" but your database has "Healthplus.ai"
- The script handles this automatically by cleaning emojis

**Month format:**
- The script accepts month names (January, February, etc.) or numbers (1-12)
- Make sure the CSV has valid month values

**Year format:**
- Years should be 4-digit (e.g., 2024, 2025)

## Verifying the Import

After importing, you can verify the data in Supabase:

```sql
SELECT 
  c.name as company,
  mr.month,
  mr.year,
  mr.challenge_team,
  mr.challenge_product,
  mr.challenge_sales,
  mr.challenge_marketing,
  mr.challenge_finance,
  mr.challenge_fundraise
FROM monthly_reports mr
JOIN companies c ON mr.company_id = c.id
ORDER BY c.name, mr.year DESC, mr.month DESC;
```

## Troubleshooting

**"Company not found" errors:**
- Check the company name in the CSV matches your database
- Company names are matched case-insensitively
- Emojis and special characters are automatically removed

**"Invalid month/year" errors:**
- Check that month values are valid month names or 1-12
- Check that year values are 4-digit years

**Import errors:**
- Check that you have the service role key set correctly
- Verify the migrations have been run
- Check Supabase logs for detailed error messages

