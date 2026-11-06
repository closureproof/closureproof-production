-- TEST FIXTURE ONLY. Reproduces the column structure supplied by the user.
-- Never run this file in a customer project: it creates synthetic test records.
create table public.cp_organisations (
 id uuid primary key, name text not null, owner_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.cp_memberships (
 organisation_id uuid not null references public.cp_organisations(id), user_id uuid not null references auth.users(id),
 role text not null check(role in ('owner','reviewer','viewer')), active boolean not null default true,
 created_at timestamptz not null default now(), primary key(organisation_id,user_id)
);
create table public.cp_findings (
 id uuid primary key, organisation_id uuid not null references public.cp_organisations(id), title text not null,
 description text, severity text not null check(severity in ('low','medium','high')), status text not null check(status in ('open','closed')),
 framework text, control_reference text, due_at timestamptz, created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.cp_evidence (
 id uuid primary key, organisation_id uuid not null references public.cp_organisations(id), finding_id uuid not null references public.cp_findings(id),
 filename text not null, storage_path text not null, mime_type text, sha256 text, evidence_version integer not null,
 uploaded_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.cp_reviews (
 id uuid primary key, organisation_id uuid not null references public.cp_organisations(id), finding_id uuid not null references public.cp_findings(id),
 decision text not null check(decision in ('approved','rejected','changes_requested')), comment text,
 reviewer_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
insert into public.cp_organisations values('44444444-4444-4444-8444-444444444444','Existing workspace','11111111-1111-4111-8111-111111111111','2026-10-01T10:00:00Z');
insert into public.cp_memberships(organisation_id,user_id,role,active) values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','owner',true),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','reviewer',true),
 ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','viewer',false);
insert into public.cp_findings values(
 '55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','Legacy access review record',
 'Earlier finding with a reviewer decision but no structured checklist.','high','closed','ISO27001:2022','A.5.18','2026-12-01T10:00:00Z',
 '11111111-1111-4111-8111-111111111111','2026-10-02T10:00:00Z');
insert into public.cp_evidence values(
 '66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555',
 'earlier-evidence.pdf','old-bucket/original-file.pdf',null,null,2,'11111111-1111-4111-8111-111111111111','2026-10-03T10:00:00Z');
insert into public.cp_reviews values(
 '77777777-7777-4777-8777-777777777777','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555',
 'approved','Original review comment retained exactly.','22222222-2222-4222-8222-222222222222','2026-10-04T10:00:00Z');
