import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;`);
const read = (name) =>
  fs.readFile(new URL('../../../supabase/migrations/' + name, import.meta.url), 'utf8');
for (const name of [
  '20261106000200_public_pilot.sql',
  '20261106000300_iso27001_checklists.sql',
  '20261109000100_review_completion_workflow.sql',
  '20261109000200_control_review_scopes.sql',
  '20261109000300_simplified_reviewer_judgement.sql',
  '20261109000400_conditional_judgement.sql',
])
  await db.exec(await read(name));
const migration = await read('20261111000100_ai_document_extraction.sql');
await db.exec(migration);
await db.exec(migration);

await db.exec(await read('20261111000500_ai_review_preparation.sql'));
await db.exec(await read('20261111000500_ai_review_preparation.sql'));
await db.exec(
  await fs.readFile(
    new URL('../../../supabase/tests/ai_extraction_fixture.sql', import.meta.url),
    'utf8',
  ),
);
await db.exec(await read('20261112000100_review_requests.sql'));
await db.exec(await read('20261112000100_review_requests.sql'));
let checks = 0;
function assert(ok, message) {
  if (!ok) throw Error(message);
  checks++;
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
async function rpc(name, args = []) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) value`,
      args,
    )
  ).rows[0].value;
}
const run = await rpc('cpp_test_ai_evidence');
const finding = run.finding_id;
const id = crypto.randomUUID();
const before = (
  await db.query('select revision,protocol,lifecycle from public.cpp_findings where id=$1', [
    finding,
  ])
).rows[0];
await db.exec('set role anon');
const data = {
  actor: 'Reviewer Taylor',
  kind: 'scope',
  reason: 'The finding also needs an independent retest.',
  requested_change: 'Include the independent retest section and supporting scope.',
};
const args = [finding, before.revision, id, 'create', JSON.stringify(data)];
assert((await rpc('cpp_review_request', args)) === id, 'Creates request');
assert((await rpc('cpp_review_request', args)) === id, 'Duplicate click returns same request');
await rejects(
  () =>
    rpc('cpp_review_request', [
      finding,
      before.revision,
      id,
      'create',
      JSON.stringify({ ...data, reason: 'A different request basis.' }),
    ]),
  'Idempotency rejects changed input',
);
await rejects(
  () =>
    rpc('cpp_review_request', [
      finding,
      before.revision - 1,
      crypto.randomUUID(),
      'create',
      JSON.stringify(data),
    ]),
  'Stale revision blocked',
);
await rejects(
  () =>
    rpc('cpp_review_request', [
      finding,
      before.revision,
      crypto.randomUUID(),
      'create',
      JSON.stringify({ ...data, kind: 'other' }),
    ]),
  'Unknown request type blocked',
);
await rejects(
  () =>
    rpc('cpp_review_request', [
      finding,
      before.revision,
      crypto.randomUUID(),
      'create',
      JSON.stringify({ ...data, reason: 'x' }),
    ]),
  'Reason required',
);
await rejects(
  () => db.query("update public.cpp_review_requests set status='resolved' where id=$1", [id]),
  'Direct writes blocked',
);
await rejects(
  () =>
    rpc('cpp_review_request', [
      finding,
      before.revision,
      id,
      'resolve',
      JSON.stringify({
        actor: 'Reviewer Taylor',
        resolution: 'This cannot be resolved before a response.',
      }),
    ]),
  'Cannot resolve unanswered request',
);
await rpc('cpp_review_request', [
  finding,
  before.revision,
  id,
  'respond',
  JSON.stringify({
    actor: 'Submission Owner',
    response: 'The proposed correction is disputed; see the existing audit scope.',
  }),
]);
assert(
  (await db.query('select status from public.cpp_review_requests where id=$1', [id])).rows[0]
    .status === 'responded',
  'Response is not automatic resolution',
);
await rpc('cpp_review_request', [
  finding,
  before.revision,
  id,
  'resolve',
  JSON.stringify({
    actor: 'Reviewer Taylor',
    resolution: 'Inspected the existing audit scope; no amendment is needed.',
  }),
]);
const saved = (await db.query('select * from public.cpp_review_requests where id=$1', [id]))
  .rows[0];
assert(
  saved.status === 'resolved' &&
    saved.requested_by === 'Reviewer Taylor' &&
    saved.response_by === 'Submission Owner' &&
    saved.resolved_at,
  'Preserves request, response and verification attribution',
);
await rejects(
  () =>
    rpc('cpp_review_request', [
      finding,
      before.revision,
      id,
      'respond',
      JSON.stringify({ actor: 'Submission Owner', response: 'Attempt to overwrite the response.' }),
    ]),
  'Resolved request cannot be overwritten',
);
await rpc('cpp_review_request', [
  finding,
  before.revision,
  crypto.randomUUID(),
  'create',
  JSON.stringify({ ...data, kind: 'evidence' }),
]);
const after = (
  await db.query('select revision,protocol,lifecycle from public.cpp_findings where id=$1', [
    finding,
  ])
).rows[0];
assert(
  JSON.stringify(before) === JSON.stringify(after),
  'Requests never amend scope or recommendation',
);
assert(
  Number(
    (
      await db.query(
        "select count(*) total from public.cpp_events where finding_id=$1 and title like 'Review request:%'",
        [finding],
      )
    ).rows[0].total,
  ) === 4,
  'One event per actual action',
);
console.log(`${checks} isolated review-request SQL checks passed`);
await db.close();
