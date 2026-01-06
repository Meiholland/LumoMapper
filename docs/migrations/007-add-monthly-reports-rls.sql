-- Migration: Add RLS policies for monthly_reports table

-- Enable RLS on monthly_reports table
alter table public.monthly_reports enable row level security;

-- Admins can view all monthly reports
create policy "Admins can view all monthly reports"
  on public.monthly_reports
  for select
  using (
    exists (
      select 1 from public.users
      where auth_user_id = auth.uid() and role = 'admin'
    )
  );

-- Admins can insert/update/delete monthly reports
create policy "Admins can manage monthly reports"
  on public.monthly_reports
  for all
  using (
    exists (
      select 1 from public.users
      where auth_user_id = auth.uid() and role = 'admin'
    )
  );

