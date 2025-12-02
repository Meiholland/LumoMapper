create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text generated always as (lower(regexp_replace(name, '\s+', '-', 'g'))) stored,
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  company_id uuid references public.companies(id),
  role text not null default 'member',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  pillar text not null,
  label text not null,
  description text,
  sequence smallint not null default 0,
  unique (pillar, label)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  prompt text not null,
  weight numeric not null default 1,
  sequence smallint not null default 0,
  unique (category_id, company_id, prompt)
);

-- Questions can be company-specific (company_id = <uuid>) or standard/template (company_id = NULL).
-- When a company imports assessment data, company-specific questions are created automatically.
-- Companies without imported data use standard questions (company_id IS NULL).
-- The unique constraint allows the same prompt in different companies, but ensures uniqueness within a company+category.

create table public.assessment_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  year smallint not null,
  quarter smallint not null check (quarter between 1 and 4),
  submitted_by uuid references public.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  unique (company_id, year, quarter)
);

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_period_id uuid not null references public.assessment_periods(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  score smallint not null check (score between 0 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (assessment_period_id, question_id)
);

-- Run `npm run seed:questions` after executing this schema to populate
-- categories and questions from docs/question-bank.json.
-- Note: Seeded questions will have company_id = NULL (standard questions).

-- IMPORTANT: After creating the schema, run migration 002-add-company-id-to-questions.sql
-- if you're upgrading an existing database. For new databases, the schema above already includes company_id.

-- Seed portfolio companies
insert into public.companies (name)
values
('Aiosyn'),
('Airhub'),
('Alphabeats'),
('Autoscriber'),
('Beyond Weather'),
('Chunkx'),
('CityLegends'),
('Cordys Analytics'),
('Enatom'),
('Enliven'),
('Fimo Health'),
('Fruitpunch.ai'),
('GraphPolaris'),
('Healthplus.ai'),
('Hema.to'),
('HULO'),
('Integer Technologies'),
('Lendorse'),
('LinkSight'),
('Lumo Labs'),
('Maaind'),
('Metacampus'),
('Nuclivision'),
('Protyon'),
('Roboat'),
('Scenexus'),
('Skyfora'),
('Surgical Reality'),
('Sycai Medical'),
('Tap Electric'),
('Whispp');

