# Company-Specific Questions Architecture

## Overview

The application now supports company-specific questions, allowing each company to have custom question wording while maintaining a standard question bank for new companies.

## Key Changes

### Database Schema

1. **Added `company_id` to `questions` table** (nullable)
   - `company_id = NULL` → Standard/template questions (for new companies)
   - `company_id = <uuid>` → Company-specific questions (created during import)

2. **Updated unique constraint**
   - Changed from `unique (category_id, prompt)` 
   - To `unique (category_id, company_id, prompt)`
   - Allows same prompt in different companies, but ensures uniqueness within a company+category

### Migration

Run `docs/migrations/002-add-company-id-to-questions.sql` to upgrade existing databases.

For new databases, the schema in `docs/supabase-schema.sql` already includes `company_id`.

## How It Works

### Question Resolution Logic

For any given company:

1. **Check if company has company-specific questions**
   - Query: `SELECT id FROM questions WHERE company_id = <company_id> LIMIT 1`

2. **If company-specific questions exist:**
   - Use only company-specific questions (`company_id = <company_id>`)
   - Dashboard, forms, and charts display only these questions

3. **If no company-specific questions exist:**
   - Use standard questions (`company_id IS NULL`)
   - New companies without imported data use standard questions

### Import Process

When importing assessment data via `/admin/import`:

1. **Categories are created/fetched globally**
   - Categories remain shared across all companies
   - Format: `{ pillar: string, label: string }`

2. **Questions are created company-specifically**
   - Each statement in the JSON becomes a question for that company
   - Questions are created on-the-fly if they don't exist
   - Matching is done by normalized text (case-insensitive, punctuation-removed)

3. **100% Data Capture**
   - All statements from JSON are captured as questions
   - No data loss due to mismatched wording
   - Company-specific questions ensure consistency going forward

### Dashboard & Forms

- **Dashboard** (`/dashboard`): Shows radar charts based on company-specific questions (or standard if none exist)
- **Assessment Form** (`/assessments/new`): Displays company-specific questions for users to fill out
- **Charts**: Only display categories/axes that have responses (questions created from imports)

## Benefits

1. ✅ **No Data Loss**: All imported statements become questions
2. ✅ **Company Flexibility**: Each company can have custom question wording
3. ✅ **Consistency**: Once imported, a company uses the same questions across quarters
4. ✅ **Backward Compatible**: Existing standard questions remain available
5. ✅ **Fallback**: New companies without imports use standard questions

## Migration Steps

1. Run the migration SQL:
   ```sql
   -- See docs/migrations/002-add-company-id-to-questions.sql
   ```

2. Existing questions will have `company_id = NULL` (standard questions)

3. When importing data for a company:
   - Company-specific questions are created automatically
   - Future assessments for that company use these questions

4. Companies without imported data continue using standard questions

## Technical Details

### Query Pattern

```typescript
// Check if company has custom questions
const { data: companyQuestions } = await supabase
  .from("questions")
  .select("id")
  .eq("company_id", companyId)
  .limit(1);

// Query questions (company-specific or standard)
const query = supabase
  .from("questions")
  .select("...")
  .order("sequence");

if (companyQuestions && companyQuestions.length > 0) {
  query.eq("company_id", companyId); // Company-specific
} else {
  query.is("company_id", null); // Standard
}
```

### Import Logic

The import process:
1. Normalizes statement text for matching
2. Checks company-specific questions first
3. Creates new company-specific questions if not found
4. Associates questions with categories (creating categories if needed)
5. Stores responses linked to company-specific questions

## Future Considerations

- **Question Editing**: Could add UI to edit company-specific questions
- **Question Templates**: Could allow copying standard questions as starting point
- **Question Versioning**: Could track changes to questions over time
- **Bulk Operations**: Could add tools to manage questions across companies


