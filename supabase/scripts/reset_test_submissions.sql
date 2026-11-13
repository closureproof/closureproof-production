-- Run in Supabase SQL Editor only when ALL current cpp_* submissions are test data.
-- Preserves schema, workspace configuration, checklists, protocol versions,
-- daily AI usage accounting and historical cp_* / cpw_* records.
-- Storage objects are not deleted by this script.
BEGIN;
SET LOCAL lock_timeout = '10s';

TRUNCATE TABLE
  public.cpp_review_requests,
  public.cpp_ai_review_proposals,
  public.cpp_engine_completions,
  public.cpp_ai_confirmations,
  public.cpp_ai_submissions,
  public.cpp_ai_runs,
  public.cpp_approval_decisions,
  public.cpp_approval_requests,
  public.cpp_followups,
  public.cpp_workflow_commands,
  public.cpp_reports,
  public.cpp_review_cycles,
  public.cpp_reviews,
  public.cpp_legacy_records,
  public.cpp_events,
  public.cpp_evidence,
  public.cpp_findings
CONTINUE IDENTITY RESTRICT;

COMMIT;
