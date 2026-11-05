-- Run after the migration as a database administrator. Fixtures are rolled back.
BEGIN;

CREATE FUNCTION pg_temp.expect_demo_request_rejected(patch jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  payload jsonb := '{"name":"Example Person","email":"person@example.test","company_name":"Example Ltd","contact_person":"Example Contact"}'::jsonb || patch;
BEGIN
  BEGIN
    INSERT INTO public.demo_requests (name, email, company_name, contact_person, contact_email, contact_phone)
    VALUES (payload->>'name', payload->>'email', payload->>'company_name', payload->>'contact_person', payload->>'contact_email', payload->>'contact_phone');
  EXCEPTION
    WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN
      RETURN;
  END;
  RAISE EXCEPTION 'Invalid demo request was accepted: %', patch;
END;
$$;

DO $$
DECLARE
  saved public.demo_requests%ROWTYPE;
BEGIN
  INSERT INTO public.demo_requests (name, email, company_name, contact_person)
  VALUES ('Example Person', 'person@example.test', 'Example Ltd', 'Example Contact')
  RETURNING * INTO saved;

  IF saved.id IS NULL OR saved.created_at IS NULL OR saved.contact_email IS NOT NULL OR saved.contact_phone IS NOT NULL THEN
    RAISE EXCEPTION 'Generated fields or nullable contact fields are incorrect';
  END IF;

  -- Repeat enquiries are permitted; optional contact details can be supplied.
  INSERT INTO public.demo_requests (name, email, company_name, contact_person, contact_email, contact_phone)
  VALUES ('Example Person', 'person@example.test', 'Example Ltd', 'Example Contact', 'contact@example.test', '+44 20 0000 0000');

  PERFORM pg_temp.expect_demo_request_rejected('{"name":null}');
  PERFORM pg_temp.expect_demo_request_rejected('{"email":null}');
  PERFORM pg_temp.expect_demo_request_rejected('{"company_name":null}');
  PERFORM pg_temp.expect_demo_request_rejected('{"contact_person":null}');
  PERFORM pg_temp.expect_demo_request_rejected('{"name":"   "}');
  PERFORM pg_temp.expect_demo_request_rejected(jsonb_build_object('company_name', E'\t\n'));
  PERFORM pg_temp.expect_demo_request_rejected('{"contact_person":""}');
  PERFORM pg_temp.expect_demo_request_rejected('{"email":"invalid-address"}');
  PERFORM pg_temp.expect_demo_request_rejected('{"contact_email":""}');
  PERFORM pg_temp.expect_demo_request_rejected('{"contact_email":"invalid-address"}');
  PERFORM pg_temp.expect_demo_request_rejected('{"contact_phone":"   "}');
  PERFORM pg_temp.expect_demo_request_rejected(jsonb_build_object('name', repeat('x', 121)));
  PERFORM pg_temp.expect_demo_request_rejected(jsonb_build_object('company_name', repeat('x', 181)));
  PERFORM pg_temp.expect_demo_request_rejected(jsonb_build_object('contact_person', repeat('x', 121)));
  PERFORM pg_temp.expect_demo_request_rejected(jsonb_build_object('email', repeat('x', 250) || '@example.test'));
  PERFORM pg_temp.expect_demo_request_rejected(jsonb_build_object('contact_email', repeat('x', 250) || '@example.test'));
  PERFORM pg_temp.expect_demo_request_rejected(jsonb_build_object('contact_phone', repeat('1', 41)));

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.demo_requests'::regclass) THEN
    RAISE EXCEPTION 'Row-level security is not enabled';
  END IF;
  IF has_table_privilege('anon', 'public.demo_requests', 'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated', 'public.demo_requests', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Browser roles must not have access to demo enquiries';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.demo_requests', 'INSERT') THEN
    RAISE EXCEPTION 'Trusted intake role is missing insert permission';
  END IF;
END;
$$;

-- Exercise the actual intake role, including its RLS bypass on Supabase.
SET LOCAL ROLE service_role;
INSERT INTO public.demo_requests (name, email, company_name, contact_person)
VALUES ('Backend Test', 'backend@example.test', 'Example Ltd', 'Backend Contact');
RESET ROLE;

ROLLBACK;
