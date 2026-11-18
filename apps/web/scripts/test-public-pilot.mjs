import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;
 grant select,insert,delete on storage.objects to anon,authenticated;`);
const migration = await fs.readFile(
  new URL('../../../supabase/migrations/20261106000200_public_pilot.sql', import.meta.url),
  'utf8',
);
await db.exec(migration);
await db.exec(migration);
await db.exec('set role anon');
let checks = 0;
function assert(ok, message) {
  if (!ok) throw Error(message);
  checks++;
}
async function rpc(name, args = []) {
  return (
    await db.query(
      `select public.cpp_${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) value`,
      args,
    )
  ).rows[0].value;
}
async function rejects(fn, message) {
  try {
    await fn();
  } catch {
    checks++;
    return;
  }
  throw Error(message);
}
const boot = await rpc('bootstrap');
assert(boot.organisations.length === 1, 'Public workspace available without auth');
const org = boot.organisations[0].id;
assert(
  (await db.query('select * from public.cpp_findings')).rows.length === 0,
  'No dummy findings',
);
const input = {
  title: 'Public pilot submission',
  description: 'A human supplied real pilot finding description.',
  owner: 'Test submitter',
  severity: 'Medium',
  protocol_code: 'access',
  account_reference: 'Demo environment',
  affected_systems: 'Application',
  resources: 'Users A and B',
  approved_baseline: 'Approved access list',
  root_cause: 'Review not completed',
  recurrence_prevention: 'Schedule manual review',
  corrective_action: 'Reconcile access list',
  implementation_date: null,
  deadline: null,
  control_reference: '',
};
const id = await rpc('create_finding', [org, JSON.stringify(input)]);
assert(
  (await db.query('select * from public.cpp_findings')).rows.length === 1,
  'Anonymous submission persists',
);
const upload = await rpc('begin_upload', [
  id,
  1,
  JSON.stringify({ filename: 'pilot.txt', mime: 'text/plain', size: 5, sha256: 'a'.repeat(64) }),
  JSON.stringify({
    evidence_type: 'Review record',
    source_system: 'Demo app',
    source_account: 'Demo',
    covered_resources: 'A,B',
    description: 'Manual test evidence',
    submitted_by: 'Sam Submitter',
  }),
]);
await db.query(
  "insert into storage.objects(bucket_id,name,metadata) values('closureproof-pilot-evidence',$1,$2)",
  [upload.path, JSON.stringify({ size: 5, mimetype: 'text/plain' })],
);
await rpc('finalize_upload', [upload.id, 1]);
assert(
  (await db.query('select * from storage.objects')).rows.length === 1,
  'Anonymous evidence access',
);
assert(
  (await rpc('record_file_access', [upload.id, 'download'])).path === upload.path,
  'Anonymous original download',
);
const f = (await db.query('select * from public.cpp_findings where id=$1', [id])).rows[0];
assert(f.revision === 2, 'Evidence creates new revision');
const body = {
  reviewer: 'Reviewer Jane',
  independent: false,
  independence_notes: '',
  publish: true,
  checks: f.protocol.checks.map((c) => ({
    check_id: c.id,
    result: 'unknown',
    reason: 'More source records are required for manual inspection.',
    evidence_ids: [],
    source_location: '',
  })),
  recommendation: 'Not closure ready',
  recommendation_reason: 'Missing evidence requires additional manual inspection.',
  next_status: 'changes_requested',
  clarification_request: 'Please provide the missing access review records.',
};
const reviewId = await rpc('save_review', [id, 2, JSON.stringify(body)]);
const review = (await db.query('select * from public.cpp_reviews where id=$1', [reviewId])).rows[0];
assert(review.reviewer_name === 'Reviewer Jane', 'Self-declared reviewer name saved');
assert(review.data.authorship.includes('not authenticated'), 'No verified identity claim');
assert(review.data.recommendation === 'Not closure ready', 'Human recommendation stored verbatim');
await rpc('update_finding', [id, 2, JSON.stringify({ ...input, title: 'Updated public finding' })]);
await rejects(() => rpc('save_review', [id, 2, JSON.stringify(body)]), 'Stale review should fail');
assert(
  (await db.query('select finding_revision from public.cpp_reviews')).rows[0].finding_revision ===
    2,
  'Earlier review remains on prior revision',
);
await db.exec('reset role');
assert(
  (
    await db.query(
      "select count(*) n from pg_constraint where connamespace='public'::regnamespace and confrelid=to_regclass('auth.users')",
    )
  ).rows[0].n === 0,
  'No account dependencies',
);
await db.close();
console.log(`Public pilot SQL: ${checks} checks passed (no auth schema or accounts).`);
