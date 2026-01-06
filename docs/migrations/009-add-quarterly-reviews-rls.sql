-- Migration: Add RLS policies for quarterly_reviews table

-- Enable RLS on quarterly_reviews table
alter table public.quarterly_reviews enable row level security;

-- Admins can view all quarterly reviews
create policy "Admins can view all quarterly reviews"
  on public.quarterly_reviews
  for select
  using (
    exists (
      select 1 from public.users
      where auth_user_id = auth.uid() and role = 'admin'
    )
  );

-- Admins can insert/update/delete quarterly reviews
create policy "Admins can manage quarterly reviews"
  on public.quarterly_reviews
  for all
  using (
    exists (
      select 1 from public.users
      where auth_user_id = auth.uid() and role = 'admin'
    )
  );

