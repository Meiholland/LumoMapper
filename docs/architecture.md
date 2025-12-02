## VC Progress Portal – Architecture Notes

- **Frontend**: Next.js App Router (React 19, TypeScript) + Tailwind CSS v4. Chart.js handles radar/spider visualisations through `react-chartjs-2`.
- **Auth**: Supabase email/password (Magic links or OAuth can be added later). Each sign-up selects a `company_id`.
- **Data Model**
  - `companies(id, name, slug, created_at)`
  - `users(id, auth_user_id, full_name, company_id, role, created_at)`
  - `categories(id, pillar, label, description, sequence)`
  - `questions(id, category_id, prompt, weight, sequence)`
  - `assessment_periods(id, company_id, year, quarter, submitted_by, submitted_at)`
  - `assessment_responses(id, assessment_period_id, question_id, score, comment, created_at)`
- **Aggregation**: an assessment aggregates to category averages -> four radar charts (Business Concept, Customers, Admin + Finance, Organization). Category weights are derived from question `weight`.
- **Import Path**: Admin-only upload endpoint accepts CSV/JSON (converted from XLSX). Server action/Edge Function batches inserts into `assessments`, `responses`, keeping original timestamps for historical benchmarking.
- **Next Steps**
  1. Run `docs/supabase-schema.sql` then `npm run seed:questions` to populate pillars and statements.
  2. Implement protected routes for dashboard + assessment forms.
  3. Build admin import UI (CSV/XLSX) and question bank editor.

