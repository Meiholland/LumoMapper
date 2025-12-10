-- Enable Row Level Security (RLS) on all tables
-- This provides defense-in-depth security at the database level

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can view their own user record
CREATE POLICY "Users can view own record"
  ON public.users
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Users can update their own user record (limited fields)
CREATE POLICY "Users can update own record"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Admins can view all users
CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all users
CREATE POLICY "Admins can update all users"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- COMPANIES TABLE POLICIES
-- ============================================================================

-- All authenticated users can view companies (for dropdowns, etc.)
CREATE POLICY "Authenticated users can view companies"
  ON public.companies
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete companies
CREATE POLICY "Admins can manage companies"
  ON public.companies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- CATEGORIES TABLE POLICIES
-- ============================================================================

-- All authenticated users can view categories (public data)
CREATE POLICY "Authenticated users can view categories"
  ON public.categories
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
  ON public.categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- QUESTIONS TABLE POLICIES
-- ============================================================================

-- Users can view questions for their company or standard questions (company_id IS NULL)
CREATE POLICY "Users can view relevant questions"
  ON public.questions
  FOR SELECT
  USING (
    company_id IS NULL OR
    company_id IN (
      SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

-- Only admins can manage questions
CREATE POLICY "Admins can manage questions"
  ON public.questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- ASSESSMENT_PERIODS TABLE POLICIES
-- ============================================================================

-- Users can view assessment periods for their company
CREATE POLICY "Users can view own company assessments"
  ON public.assessment_periods
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

-- Users can insert assessment periods for their company
CREATE POLICY "Users can create assessments for own company"
  ON public.assessment_periods
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

-- Admins can view all assessment periods
CREATE POLICY "Admins can view all assessments"
  ON public.assessment_periods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can manage all assessment periods
CREATE POLICY "Admins can manage all assessments"
  ON public.assessment_periods
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- ASSESSMENT_RESPONSES TABLE POLICIES
-- ============================================================================

-- Users can view responses for assessments in their company
CREATE POLICY "Users can view own company responses"
  ON public.assessment_responses
  FOR SELECT
  USING (
    assessment_period_id IN (
      SELECT ap.id FROM public.assessment_periods ap
      INNER JOIN public.users u ON ap.company_id = u.company_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Users can insert responses for assessments in their company
CREATE POLICY "Users can create responses for own company"
  ON public.assessment_responses
  FOR INSERT
  WITH CHECK (
    assessment_period_id IN (
      SELECT ap.id FROM public.assessment_periods ap
      INNER JOIN public.users u ON ap.company_id = u.company_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Admins can view all responses
CREATE POLICY "Admins can view all responses"
  ON public.assessment_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can manage all responses
CREATE POLICY "Admins can manage all responses"
  ON public.assessment_responses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

