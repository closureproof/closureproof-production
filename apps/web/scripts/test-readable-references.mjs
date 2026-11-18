process.on('unhandledRejection', (error) => {
  console.error({ message: error.message, code: error.code, where: error.where });
  process.exit(1);
});
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;`);
const read = (name) =>
  fs.readFile(new URL('../../../supabase/migrations/' + name, import.meta.url), 'utf8');
for (const name of [
  '20261106000200_public_pilot.sql',
  '20261106000300_iso27001_checklists.sql',
  '20261109000100_review_completion_workflow.sql',
  '20261109000200_control_review_scopes.sql',
  '20261109000300_simplified_reviewer_judgement.sql',
  '20261109000400_conditional_judgement.sql',
  '20261111000100_ai_document_extraction.sql',
  '20261111000200_rules_supported_assessment.sql',
])
  await db.exec(await read(name));
await db.exec(await read('20261111000200_rules_supported_assessment.sql'));
await db.exec(await read('20261111000300_checklist_linked_engine.sql'));
await db.exec(await read('20261111000300_checklist_linked_engine.sql'));
await db.exec(await read('20261111000400_all_protocol_engines.sql'));
await db.exec(await read('20261111000400_all_protocol_engines.sql'));
await db.exec(await read('20261111000500_ai_review_preparation.sql'));
await db.exec(await read('20261112000100_review_requests.sql'));
await db.exec(
  await fs.readFile(
    new URL('../../../supabase/tests/ai_extraction_fixture.sql', import.meta.url),
    'utf8',
  ),
);
let checks = 0;
const assert = (ok, message) => {
  if (!ok) throw Error(message);
  checks++;
};
async function rejects(fn, message) {
  try {
    await fn();
  } catch {
    checks++;
    return;
  }
  throw Error(message);
}
async function rpc(name, args = []) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) value`,
      args,
    )
  ).rows[0].value;
}
const org = '00000000-0000-4000-8000-000000000001';
const details = {
  title: 'Reference test finding',
  description: 'Synthetic access review finding for reference checks.',
  owner: 'Test owner',
  severity: 'Medium',
  protocol_code: 'access',
  account_reference: 'Synthetic account',
  affected_systems: 'Test environment',
  resources: 'Users A and B',
  approved_baseline: 'Approved access list',
  root_cause: 'Review omitted users',
  corrective_action: 'Review all users',
  recurrence_prevention: 'Reconcile population',
  control_reference: 'AUD-TEST',
  implementation_date: null,
  deadline: null,
};
const scope = {
  version: '1.0-control-scope',
  control_ids: ['A.5.18'],
  unknown_reason: '',
  additional_task_ids: [],
  excluded_tasks: {},
  additional_modules: [],
  excluded_modules: {},
};
const manual = await rpc('cpp_create_finding', [org, JSON.stringify(details)]);
const run = await rpc('cpp_test_ai_multi_report');
const first = await rpc('cpp_submit_extracted_finding', [
  run.id,
  0,
  JSON.stringify(details),
  JSON.stringify(scope),
  'Submitter Test',
]);
const second = await rpc('cpp_submit_extracted_finding', [
  run.id,
  1,
  JSON.stringify(details),
  JSON.stringify(scope),
  'Submitter Test',
]);
const upload = await rpc('cpp_begin_upload', [
  manual,
  1,
  JSON.stringify({
    filename: 'reference.txt',
    mime: 'text/plain',
    size: 4,
    sha256: 'a'.repeat(64),
  }),
  JSON.stringify({
    evidence_type: 'Test record',
    source_system: 'Test system',
    source_account: 'Test account',
    covered_resources: 'A,B',
    description: 'Synthetic record for reference checks',
    submitted_by: 'Test submitter',
  }),
]);
const review = crypto.randomUUID();
await db.query(
  "insert into public.cpp_reviews(id,finding_id,organisation_id,finding_revision,reviewer_id,reviewer_name,status,data) values($1,$2,$3,1,'00000000-0000-4000-8000-000000000002','Historical reviewer','published','{\"sentinel\":\"unchanged historical review\"}')",
  [review, manual, org],
);
const before = (
  await db.query('select details,revision from public.cpp_findings where id=$1', [manual])
).rows[0];
const migration = await read('20261113000300_readable_references.sql');
await db.exec(migration);
const row = async (table, id) =>
  (await db.query(`select * from public.${table} where id=$1`, [id])).rows[0];
const m = await row('cpp_findings', manual),
  a = await row('cpp_findings', first),
  b = await row('cpp_findings', second),
  r = await row('cpp_ai_runs', run.id),
  e = await row('cpp_evidence', upload.id);
assert(/^CP-FND-\d{4}-\d{6}$/.test(m.finding_reference), 'Finding format');
assert(/^CP-SUB-\d{4}-\d{6}$/.test(m.submission_reference), 'Standalone submission format');
assert(/^CP-EVD-\d{4}-\d{6}$/.test(e.evidence_reference), 'Evidence format');
assert(
  a.submission_reference === b.submission_reference &&
    a.submission_reference === r.submission_reference,
  'One report reference shared by its findings',
);
assert(a.finding_reference !== b.finding_reference, 'Finding references distinct');
assert(m.submission_reference !== r.submission_reference, 'Standalone submission stays separate');
assert(m.id === manual && e.finding_id === manual, 'UUID and evidence links unchanged');
assert(m.revision === before.revision, 'Backfill does not create material revisions');
assert(
  JSON.stringify((await row('cpp_reviews', review)).data) ===
    '{"sentinel":"unchanged historical review"}',
  'Historical review snapshot unchanged',
);
const total = async () =>
  (await db.query('select sum(last_value)::integer n from cpp_private.reference_counters')).rows[0]
    .n;
const allocated = await total();
await db.exec(migration);
assert((await total()) === allocated, 'Migration rerun does not reallocate references');
assert(
  (await row('cpp_findings', manual)).finding_reference === m.finding_reference,
  'Backfilled IDs stable',
);
await rejects(
  () => db.query("update public.cpp_findings set finding_reference='forged' where id=$1", [manual]),
  'Cannot overwrite finding reference',
);
await rejects(
  () =>
    db.query("update public.cpp_evidence set evidence_reference='forged' where id=$1", [upload.id]),
  'Cannot overwrite evidence reference',
);
await rejects(
  () =>
    db.query("update public.cpp_ai_runs set submission_reference='forged' where id=$1", [run.id]),
  'Cannot overwrite report reference',
);
await db.query(
  'update public.cpp_findings set details=details||\'{"finding_reference":"forged","submission_reference":"forged"}\' where id=$1',
  [manual],
);
assert(
  (await row('cpp_findings', manual)).details.finding_reference === m.finding_reference,
  'JSON cannot forge display reference',
);
await db.exec('set role anon');
await rejects(
  () => db.query('select * from cpp_private.reference_counters'),
  'Counters not public',
);
await rejects(
  () => db.query("select cpp_private.next_reference('SUB',now())"),
  'Public cannot allocate arbitrary references',
);
const fresh = await rpc('cpp_create_finding', [
  org,
  JSON.stringify({ ...details, title: 'New referenced finding' }),
]);
await db.exec('reset role');
const freshRow = await row('cpp_findings', fresh);
assert(
  freshRow.finding_reference !== m.finding_reference &&
    freshRow.details.finding_reference === freshRow.finding_reference,
  'New RPC findings receive canonical snapshot references',
);
const nextRun = await rpc('cpp_test_ai_multi_report');
const nextFinding = await rpc('cpp_submit_extracted_finding', [
  nextRun.id,
  0,
  JSON.stringify(details),
  JSON.stringify(scope),
  'Submitter Test',
]);
assert(
  (await row('cpp_findings', nextFinding)).submission_reference ===
    (await row('cpp_ai_runs', nextRun.id)).submission_reference,
  'New extracted finding binds to report reference',
);
const same = await rpc('cpp_submit_extracted_finding', [
  nextRun.id,
  0,
  JSON.stringify(details),
  JSON.stringify(scope),
  'Submitter Test',
]);
assert(same === nextFinding, 'Intake retry remains idempotent');
const nextYear = new Date().getUTCFullYear() + 1;
const year = (
  await db.query("select cpp_private.next_reference('SUB',$1::timestamptz) ref", [
    nextYear + '-01-01T00:00:00Z',
  ])
).rows[0].ref;
assert(year === `CP-SUB-${nextYear}-000001`, 'Annual namespace starts independently');
const overflowYear = nextYear + 1;
await db.query("insert into cpp_private.reference_counters values('EVD',$1,999999)", [
  overflowYear,
]);
assert(
  (
    await db.query("select cpp_private.next_reference('EVD',$1::timestamptz) ref", [
      overflowYear + '-01-01T00:00:00Z',
    ])
  ).rows[0].ref === `CP-EVD-${overflowYear}-1000000`,
  'Large counters never truncate',
);
await rejects(
  () => db.query("update public.cpp_ai_runs set result='{}' where id=$1", [run.id]),
  'Completed extraction result remains immutable',
);
assert(
  (
    await db.query(
      "select tgenabled from pg_trigger where tgrelid='public.cpp_ai_runs'::regclass and tgname='cpp_ai_immutable_run'",
    )
  ).rows[0].tgenabled === 'O',
  'Original immutable extraction trigger remains enabled',
);
const refs = await Promise.all(
  Array.from({ length: 20 }, () => db.query("select cpp_private.next_reference('FND',now()) ref")),
);
assert(
  new Set(refs.map((result) => result.rows[0].ref)).size === 20,
  'Repeated allocations remain unique',
);
await db.close();
console.log(`${checks} readable-reference SQL checks passed; isolated database only.`);
