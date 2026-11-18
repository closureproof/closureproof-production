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
const hash = 'a'.repeat(64);
const definition = {
  code: 'aws-iam',
  version: '0.1.0-candidate',
  title: 'SQL contract fixture only',
};
const details = {
  title: 'Privileged access remediation',
  description: 'Privileged access exceeded the approved baseline.',
  owner: 'IT owner',
  severity: 'High',
  protocol_code: 'aws-iam',
  account_reference: 'AWS test account',
  affected_systems: 'Production',
  resources: 'Role register',
  approved_baseline: 'Approved entitlements',
  root_cause: 'Excessive role grants',
  recurrence_prevention: 'Reconcile access',
  corrective_action: 'Restrict grants',
  implementation_date: null,
  deadline: null,
  control_reference: 'AUD-001',
};
const scope = {
  version: '1.0-control-scope',
  control_ids: ['A.8.2'],
  unknown_reason: '',
  additional_task_ids: [],
  excluded_tasks: {},
  additional_modules: [],
  excluded_modules: {},
};
await db.exec('set role anon');
assert(
  (await rpc('cpp_rules_engine_version')) === '1.0.0-aws-iam-candidate',
  'Schema preflight version',
);
await rejects(
  () => rpc('cpp_register_engine_protocol', [JSON.stringify(definition), hash]),
  'Public cannot publish method',
);
await rejects(() => rpc('cpp_engine_context', [crypto.randomUUID()]), 'Context is server-only');
await rejects(
  () =>
    rpc('cpp_complete_engine_review', [
      crypto.randomUUID(),
      1,
      '{}',
      '{}',
      '{}',
      crypto.randomUUID(),
      hash,
      null,
    ]),
  'Public cannot forge engine completion',
);
const fid = await rpc('cpp_create_scoped_finding', [
  org,
  JSON.stringify(details),
  JSON.stringify(scope),
]);
const finding = (await db.query('select * from public.cpp_findings where id=$1', [fid])).rows[0];
const note = 'Reviewed the submitted source and documented the remaining evidence limitations.';
const body = {
  reviewer: 'Casey',
  reviewer_conclusion: note,
  scope_confirmed: true,
  scope_confirmation_notes: note,
  checks: finding.protocol.checks.map((c) => ({
    check_id: c.id,
    result: 'unknown',
    applicability: 'under_review',
    implementation_status: 'not_assessed',
    reason: note,
    evidence_ids: [],
    source_location: '',
  })),
  closure_judgement: {
    version: '3.0-manual',
    scope_status: 'Sufficient for this finding',
    cause_status: 'Supported',
    population_requirement: 'Not required',
    population_requirement_reason: note,
    operation_requirement: 'Not required',
    operation_requirement_reason: note,
    retest_requirement: 'Not required',
    retest_requirement_reason: note,
    exceptions_status: 'None identified',
    followup_status: 'Required',
    limitations_status: 'Identified',
    established_facts: note,
    remaining_actions: note,
    limitations_overrides: note,
  },
  recommendation: 'Not closure ready',
  recommendation_reason: note,
  clarification_request: note,
  exceptions_assessed: true,
  exception_entries: [],
};
await rejects(
  () =>
    rpc('cpp_complete_review', [
      fid,
      1,
      JSON.stringify({ ...body, rules_assessment: { forged: true } }),
      crypto.randomUUID(),
      null,
    ]),
  'Manual endpoint rejects fabricated trace',
);
await db.exec('set role service_role');
await rpc('cpp_register_engine_protocol', [JSON.stringify(definition), hash]);
await rpc('cpp_register_engine_protocol', [JSON.stringify(definition), hash]);
await rejects(
  () =>
    rpc('cpp_register_engine_protocol', [
      JSON.stringify({ ...definition, title: 'Changed' }),
      hash,
    ]),
  'Protocol definition immutable per version',
);
assert(
  (await rpc('cpp_rules_checklist_version')) === '0.2.0-checklist-candidate',
  'Checklist version RPC',
);
await rejects(
  () =>
    rpc('cpp_register_engine_protocol', [
      JSON.stringify({ ...definition, version: '0.2.0-checklist-candidate' }),
      hash,
    ]),
  'Mapped version requires policy',
);
await rpc('cpp_register_engine_protocol', [
  JSON.stringify({
    ...definition,
    version: '0.2.0-checklist-candidate',
    checklistPolicy: {
      version: '1.0-iso27001-aws-iam',
      mappings: { 'iso-ACC-08': ['implemented'] },
    },
  }),
  hash,
]);
let basis = await rpc('cpp_engine_context', [fid]);
const request = crypto.randomUUID();
const snapshot = {
  protocol: { code: 'aws-iam', version: '0.1.0-candidate' },
  protocolHash: hash,
  protocolDefinition: definition,
  validationStatus: 'candidate',
  input: { findingId: fid, findingRevision: 1 },
  evaluation: { recommendation: 'not_closure_ready' },
  disposition: 'accept',
};
const call = (s = snapshot, b = basis, r = request) =>
  rpc('cpp_complete_engine_review', [
    fid,
    1,
    JSON.stringify(b),
    JSON.stringify(body),
    JSON.stringify(s),
    r,
    hash,
    null,
  ]);
await rejects(
  () => call({ ...snapshot, protocolHash: 'b'.repeat(64) }),
  'Pinned protocol hash checked',
);
await rejects(
  () =>
    call({
      ...snapshot,
      disposition: 'override',
      overrideReason: 'short',
      overrideEvidenceIds: [],
    }),
  'Override requires explicit justification',
);
await rejects(
  () => call({ ...snapshot, evaluation: { recommendation: 'closure_ready' } }),
  'Accepting mismatched recommendation rejected',
);
await rejects(
  () => call(snapshot, { ...basis, finding: { ...basis.finding, revision: 9 } }),
  'Stale complete basis rejected',
);
const invalidBody = { ...body, reviewer_conclusion: '' };
await rejects(
  () =>
    rpc('cpp_complete_engine_review', [
      fid,
      1,
      JSON.stringify(basis),
      JSON.stringify(invalidBody),
      JSON.stringify(snapshot),
      request,
      hash,
      null,
    ]),
  'Invalid review rolls back completion',
);
assert(
  (await rpc('cpp_engine_request_result', [request, hash])) === null,
  'No command record after rollback',
);
const assessment = await call();
assert(assessment === (await call()), 'Identical retry returns one result');
assert(
  (await rpc('cpp_engine_request_result', [request, hash])) === assessment,
  'Durable result lookup',
);
await rejects(
  () => rpc('cpp_engine_request_result', [request, 'b'.repeat(64)]),
  'Changed replay fingerprint rejected',
);
await db.exec('reset role');
const row = (await db.query('select * from public.cpp_reviews where id=$1', [assessment])).rows[0];
assert(
  row.data.rules_assessment.protocolHash === hash,
  'Frozen engine snapshot persisted with review',
);
assert(
  (await db.query('select lifecycle from public.cpp_findings where id=$1', [fid])).rows[0]
    .lifecycle === 'review_completed',
  'Completion does not close finding',
);
assert(
  (
    await db.query('select template_version from public.cpp_reports where assessment_id=$1', [
      assessment,
    ])
  ).rows[0].template_version === '1.5',
  'Engine report template selected',
);
assert(
  (
    await db.query('select count(*)::integer n from public.cpp_reviews where request_id=$1', [
      request,
    ])
  ).rows[0].n === 1,
  'Exactly one assessment',
);
await rejects(
  () => db.query(`update public.cpp_reviews set data='{}' where id=$1`, [assessment]),
  'Completed snapshot immutable',
);
await rejects(
  () => db.exec(`update public.cpp_engine_protocols set content_hash='${'b'.repeat(64)}'`),
  'Published candidate artefact immutable',
);
await db.exec('set role anon');
await rejects(
  () => db.query('select * from public.cpp_engine_completions'),
  'Browser cannot change trusted command records',
);
for (const code of [
  'access',
  'leavers',
  'mfa',
  'patch',
  'backup',
  'supplier',
  'logging',
  'changes',
  'incidents',
]) {
  await db.exec('set role anon');
  const categoryId = await rpc('cpp_create_finding', [
    org,
    JSON.stringify({ ...details, protocol_code: code, title: code + ' completion contract' }),
  ]);
  const category = (await db.query('select * from public.cpp_findings where id=$1', [categoryId]))
    .rows[0];
  const categoryBody = {
    ...body,
    checks: category.protocol.checks.map((c) => ({
      check_id: c.id,
      result: 'unknown',
      applicability: 'under_review',
      implementation_status: 'not_assessed',
      reason: note,
      evidence_ids: [],
      source_location: '',
    })),
  };
  const categoryDefinition = {
    code,
    version: '0.1.0-checklist-candidate',
    title: code + ' SQL fixture',
    checklistPolicy: { version: '1.0-iso27001-' + code, mappings: { fixture: ['implemented'] } },
  };
  await db.exec('set role service_role');
  await rpc('cpp_register_engine_protocol', [JSON.stringify(categoryDefinition), hash]);
  const categoryBasis = await rpc('cpp_engine_context', [categoryId]);
  const categorySnapshot = {
    ...snapshot,
    protocol: { code, version: categoryDefinition.version },
    protocolDefinition: categoryDefinition,
    input: { findingId: categoryId, findingRevision: 1 },
  };
  const args = [
    categoryId,
    1,
    JSON.stringify(categoryBasis),
    JSON.stringify(categoryBody),
    JSON.stringify(categorySnapshot),
    crypto.randomUUID(),
    hash,
    null,
  ];
  const wrong = {
    ...categorySnapshot,
    protocol: { ...categorySnapshot.protocol, code: 'aws-iam' },
  };
  await rejects(
    () =>
      rpc('cpp_complete_engine_review', [
        ...args.slice(0, 4),
        JSON.stringify(wrong),
        crypto.randomUUID(),
        hash,
        null,
      ]),
    'Cross-category snapshot rejected for ' + code,
  );
  const completed = await rpc('cpp_complete_engine_review', args);
  await db.exec('reset role');
  assert(
    (await db.query('select data from public.cpp_reviews where id=$1', [completed])).rows[0].data
      .rules_assessment.protocol.code === code,
    'Completed category snapshot ' + code,
  );
  assert(
    (
      await db.query('select template_version from public.cpp_reports where assessment_id=$1', [
        completed,
      ])
    ).rows[0].template_version === '1.5',
    'Category report template ' + code,
  );
}
await db.exec('reset role');
const protocolCount = (
  await db.query('select count(*)::integer n from public.cpp_engine_protocols')
).rows[0].n;
const organisationCount = (
  await db.query('select count(*)::integer n from public.cpp_organisations')
).rows[0].n;
await db.exec(
  await fs.readFile(
    new URL('../../../supabase/scripts/reset_test_submissions.sql', import.meta.url),
    'utf8',
  ),
);
for (const table of [
  'cpp_findings',
  'cpp_evidence',
  'cpp_reviews',
  'cpp_reports',
  'cpp_ai_runs',
  'cpp_engine_completions',
])
  assert(
    (await db.query('select count(*)::integer n from public.' + table)).rows[0].n === 0,
    'Reset clears ' + table,
  );
assert(
  (await db.query('select count(*)::integer n from public.cpp_engine_protocols')).rows[0].n ===
    protocolCount,
  'Reset preserves engine protocols',
);
assert(
  (await db.query('select count(*)::integer n from public.cpp_organisations')).rows[0].n ===
    organisationCount,
  'Reset preserves workspace',
);
console.log(`Rules-supported assessment SQL: ${checks} checks passed; isolated database only.`);
await db.close();
