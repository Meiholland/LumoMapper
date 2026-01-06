-- Migration: Add quarterly reviews cache table
-- Stores AI-generated quarterly reviews for 24 hours to avoid regenerating

create table public.quarterly_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  year smallint not null,
  quarter smallint not null check (quarter between 1 and 4),
  review_data jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (company_id, year, quarter)
);

-- Add index for efficient querying
create index idx_quarterly_reviews_company_year_quarter 
on public.quarterly_reviews(company_id, year, quarter);

-- Add index for cleanup of expired reviews
create index idx_quarterly_reviews_expires_at 
on public.quarterly_reviews(expires_at);

-- Add comment for documentation
comment on table public.quarterly_reviews is 'Cached AI-generated quarterly reviews, expires after 24 hours';
comment on column public.quarterly_reviews.review_data is 'JSON data containing executive_summary, insights, and recommendations';
comment on column public.quarterly_reviews.expires_at is 'When this cached review expires and should be regenerated';

