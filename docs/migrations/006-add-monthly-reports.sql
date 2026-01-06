-- Migration: Add monthly reports table
-- This stores monthly challenge reports from companies

create table public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  year smallint not null,
  challenge_team text,
  challenge_product text,
  challenge_sales text,
  challenge_marketing text,
  challenge_finance text,
  challenge_fundraise text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, year, month)
);

-- Add index for efficient querying by company and date
create index idx_monthly_reports_company_year_month 
on public.monthly_reports(company_id, year, month);

-- Add index for querying by year/month
create index idx_monthly_reports_year_month 
on public.monthly_reports(year, month);

-- Add comment for documentation
comment on table public.monthly_reports is 'Monthly challenge reports from portfolio companies';
comment on column public.monthly_reports.challenge_team is 'Major challenge in team/people area';
comment on column public.monthly_reports.challenge_product is 'Major challenge in product development';
comment on column public.monthly_reports.challenge_sales is 'Major challenge in sales';
comment on column public.monthly_reports.challenge_marketing is 'Major challenge in marketing';
comment on column public.monthly_reports.challenge_finance is 'Major challenge in finance';
comment on column public.monthly_reports.challenge_fundraise is 'Major challenge in fundraising';

