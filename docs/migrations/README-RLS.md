# Row Level Security (RLS) Migration Guide

## Overview

This migration enables Row Level Security (RLS) policies on all database tables to provide defense-in-depth security at the database level. This is a **critical security enhancement** that prevents unauthorized data access even if application-level checks are bypassed.

## What This Does

- Enables RLS on all tables: `users`, `companies`, `assessment_periods`, `assessment_responses`, `questions`, `categories`
- Creates policies that ensure:
  - Users can only access their own company's data
  - Users can only view/update their own user record
  - Admins can access all data
  - Public read access for categories (needed for forms)

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `004-enable-rls-policies.sql`
4. Paste and execute the SQL

### Option 2: Via Supabase CLI

```bash
supabase db push
```

Or manually:

```bash
psql $DATABASE_URL -f docs/migrations/004-enable-rls-policies.sql
```

## Testing After Migration

After applying RLS policies, test the following:

1. **Regular User Access:**
   - Log in as a regular user
   - Verify you can see your company's assessments
   - Verify you CANNOT see other companies' assessments
   - Try accessing admin endpoints (should be denied)

2. **Admin Access:**
   - Log in as an admin
   - Verify you can see all companies' assessments
   - Verify you can manage users and companies

3. **Data Isolation:**
   - Create a test user for Company A
   - Create a test user for Company B
   - Verify Company A user cannot see Company B's data

## Rollback (If Needed)

If you need to rollback, run:

```sql
-- Disable RLS (NOT RECOMMENDED - only for emergency rollback)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_periods DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "Users can view own record" ON public.users;
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
-- ... (drop all other policies)
```

## Important Notes

- **Service Role Key:** The application uses the service role key for admin operations, which bypasses RLS. This is intentional and secure as long as the service role key is kept server-side only (which it is).

- **Testing Required:** After applying RLS, thoroughly test all application functionality to ensure nothing breaks.

- **Performance:** RLS policies add a small overhead to queries, but this is negligible for most use cases.

## Security Benefits

1. **Defense in Depth:** Even if application code has bugs, RLS prevents unauthorized access
2. **Direct Database Access Protection:** If database credentials are compromised, RLS still protects data
3. **Audit Trail:** RLS policies are logged, providing better security auditing

