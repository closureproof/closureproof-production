-- PostgreSQL / Supabase: public demo enquiries, independent of user accounts.
-- Apply once through migration tooling or the Supabase SQL Editor.
BEGIN;

CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  email varchar(254) NOT NULL,
  company_name varchar(180) NOT NULL,
  contact_person varchar(120) NOT NULL,
  contact_email varchar(254),
  contact_phone varchar(40),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT demo_requests_name_not_blank CHECK (name ~ '[^[:space:]]'),
  CONSTRAINT demo_requests_company_name_not_blank CHECK (company_name ~ '[^[:space:]]'),
  CONSTRAINT demo_requests_contact_person_not_blank CHECK (contact_person ~ '[^[:space:]]'),
  -- Basic shape checks only; the intake endpoint must validate email addresses.
  CONSTRAINT demo_requests_email_format CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
  CONSTRAINT demo_requests_contact_email_format CHECK (
    contact_email IS NULL OR contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  CONSTRAINT demo_requests_contact_phone_not_blank CHECK (
    contact_phone IS NULL OR contact_phone ~ '[^[:space:]]'
  )
);

CREATE INDEX demo_requests_created_at_idx
  ON public.demo_requests (created_at DESC);

COMMENT ON TABLE public.demo_requests IS
  'Demo enquiries submitted through the public request-demo form; not tenant workspace data.';

-- Leads contain contact information. Public clients cannot read or write them.
-- The server-side intake endpoint validates requests and inserts with trusted credentials.
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.demo_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.demo_requests TO service_role;

COMMIT;
