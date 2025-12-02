-- Migration: Add company_id to questions table to support company-specific questions
-- Standard questions will have company_id = NULL
-- Company-specific questions will have company_id = <company_uuid>

-- Step 1: Add company_id column (nullable)
alter table public.questions
  add column company_id uuid references public.companies(id) on delete cascade;

-- Step 2: Set all existing questions to NULL (they are standard/template questions)
update public.questions
  set company_id = null
  where company_id is null;

-- Step 3: Drop the old unique constraint
alter table public.questions
  drop constraint if exists questions_category_id_prompt_key;

-- Step 4: Add new unique constraint that includes company_id
-- This allows the same prompt in different companies, but unique within a company+category
alter table public.questions
  add constraint questions_category_id_company_id_prompt_key
  unique (category_id, company_id, prompt);

-- Step 5: Create index for faster queries by company
create index if not exists questions_company_id_idx
  on public.questions(company_id)
  where company_id is not null;

-- Note: After this migration, the import logic will create company-specific questions
-- when importing data. Companies without imported data will use standard questions (company_id = NULL).

