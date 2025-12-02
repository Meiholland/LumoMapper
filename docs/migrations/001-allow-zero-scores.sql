-- Migration: Allow score 0 in assessment_responses
-- Run this after the initial schema if you need to update the constraint

alter table public.assessment_responses
drop constraint if exists assessment_responses_score_check;

alter table public.assessment_responses
add constraint assessment_responses_score_check check (score between 0 and 5);

