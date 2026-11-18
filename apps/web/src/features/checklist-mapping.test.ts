import { expect, it } from 'vitest';
import {
  mapAwsIamChecklist,
  applyChecklistMapping,
  type ChecklistAnswer,
} from '@closureproof/assessment-engine/checklist-mapping';
import type { Evaluation } from '@closureproof/assessment-engine';
const definitions = [
  { id: 'iso-ACC-08', label: 'Service accounts' },
  { id: 'iso-DOC-12', label: 'Admin activity records' },
];
const answer = (id: string): ChecklistAnswer => ({
  check_id: id,
  result: 'pass',
  applicability: 'yes',
  implementation_status: 'implemented',
  reason: 'The reviewer inspected the current evidence.',
  source_location: 'Section 1',
  evidence_ids: ['evidence-1'],
});
const evaluation = {
  recommendation: 'closure_ready',
  rules: [{ id: 'implemented', status: 'met' }],
  missingFacts: [],
  matchedDecisionIds: ['ready'],
  decisionReason: 'Closure-specific requirements satisfied.',
} as unknown as Evaluation;
it('maps only pinned task IDs and retains their exact assessments and evidence', () => {
  const result = mapAwsIamChecklist(
    definitions,
    definitions.map((row) => answer(row.id)),
    ['evidence-1'],
  );
  expect(result.rows).toHaveLength(2);
  expect(result.rows[0].requirementIds).toContain('implemented');
  expect(result.rows[1].requirementIds).toContain('evidence');
  expect(result.rules.every((row) => row.status === 'met')).toBe(true);
  expect(applyChecklistMapping(evaluation, result).recommendation).toBe('closure_ready');
});
it('does not let unassessed, unlinked or stale checklist rows disappear behind successful closure judgements', () => {
  for (const patch of [
    { implementation_status: 'not_assessed', result: 'unknown' },
    { evidence_ids: [] },
    { source_location: '' },
    { evidence_ids: ['replaced-file'] },
  ]) {
    const answers = definitions.map((row) => answer(row.id));
    Object.assign(answers[0], patch);
    const result = mapAwsIamChecklist(definitions, answers, ['evidence-1']);
    expect(result.rules[0].status).toBe('unknown');
    expect(applyChecklistMapping(evaluation, result).recommendation).toBe(
      'implemented_evidence_incomplete',
    );
  }
});
it('keeps justified exclusions separate from met requirements', () => {
  const answers = definitions.map((row) => ({
    ...answer(row.id),
    applicability: 'no' as const,
    implementation_status: 'not_applicable' as const,
    result: 'not_applicable' as const,
    evidence_ids: [],
  }));
  const mapped = mapAwsIamChecklist(definitions, answers, []);
  expect(mapped.rules.every((row) => row.status === 'excluded')).toBe(true);
  answers[0].reason = '';
  expect(mapAwsIamChecklist(definitions, answers, []).rules[0].status).toBe('unknown');
});
it('retains a genuine implementation gap and never infers closure readiness from Implemented alone', () => {
  const answers = definitions.map((row) => answer(row.id));
  answers[0].implementation_status = 'partially_implemented';
  answers[0].result = 'fail';
  expect(
    applyChecklistMapping(evaluation, mapAwsIamChecklist(definitions, answers, ['evidence-1']))
      .recommendation,
  ).toBe('not_closure_ready');
  expect(
    applyChecklistMapping(
      { ...evaluation, recommendation: 'not_closure_ready' },
      mapAwsIamChecklist(
        definitions,
        definitions.map((row) => answer(row.id)),
        ['evidence-1'],
      ),
    ).recommendation,
  ).toBe('not_closure_ready');
});
it('blocks empty or unmapped scope and rejects duplicate or injected checklist answers', () => {
  expect(applyChecklistMapping(evaluation, mapAwsIamChecklist([], [], [])).recommendation).not.toBe(
    'closure_ready',
  );
  expect(
    mapAwsIamChecklist(
      [{ id: 'unknown-task', label: 'Unmapped' }],
      [answer('unknown-task')],
      ['evidence-1'],
    ).rules[0].status,
  ).toBe('unknown');
  expect(() =>
    mapAwsIamChecklist(definitions, [answer('iso-ACC-08'), answer('iso-ACC-08')], ['evidence-1']),
  ).toThrow('duplicates');
  expect(() => mapAwsIamChecklist(definitions, [answer('injected')], ['evidence-1'])).toThrow(
    'pinned',
  );
});
