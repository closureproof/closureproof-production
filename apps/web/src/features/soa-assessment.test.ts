import { initialiseSoaCheck, soaCheckLabel, validateSoaChecks, prepareCompletionChecks } from './soa-assessment';

it('does not reinterpret an earlier evidence assessment as implemented', () => {
  const original = { result: 'pass' as const, reason: 'Earlier evidence judgement' };
  const current = initialiseSoaCheck(original);
  expect(current.implementation_status).toBe('not_assessed');
  expect(current.applicability).toBe('under_review');
  expect(current.previous_evidence_result).toBe('pass');
  expect(original.result).toBe('pass');
  expect(soaCheckLabel(original)).toBe('Earlier evidence assessment: Evidence sufficient');
});
it('retains the exact partially implemented status when reopening a review', () => {
  const restored = initialiseSoaCheck({ result: 'fail', implementation_status: 'partially_implemented', applicability: 'yes' } as const);
  expect(restored.implementation_status).toBe('partially_implemented');
  expect(restored.applicability).toBe('yes');
  expect(soaCheckLabel(restored)).toBe('Partially implemented');
});
it('requires a No applicability decision for not applicable', () => {
  expect(validateSoaChecks([{ result: 'not_applicable', implementation_status: 'not_applicable', applicability: 'under_review' }], true)).toContain('Select No');
  expect(validateSoaChecks([{ result: 'not_applicable', implementation_status: 'not_applicable', applicability: 'no' }], true)).toBe('');
});
it('allows incomplete assessment drafts without declaring implementation', () => {
  expect(validateSoaChecks([{ result: 'unknown', implementation_status: 'not_assessed', applicability: 'under_review' }], false)).toBe('');
});

it('completes untouched checks with one explicit reason while keeping unknown statuses', () => {
  const checks = [{ check_id: 'iso-ACC-10', result: 'unknown' as const, implementation_status: 'not_assessed' as const, applicability: 'under_review' as const, reason: '' }];
  const prepared = prepareCompletionChecks(checks, 'The source evidence has not been supplied; assessment remains outstanding.');
  expect(prepared.error).toBe('');
  expect(prepared.checks[0]).toMatchObject({ applicability: 'under_review', implementation_status: 'not_assessed', result: 'unknown', reason_source: 'shared_unassessed_note' });
  expect(checks[0].reason).toBe('');
  expect(prepareCompletionChecks(checks, '').error).toContain('shared explanation');
});
it('does not replace specific observations or use the shared note to justify not-applicable decisions', () => {
  const original = { check_id: 'specific', result: 'unknown' as const, implementation_status: 'not_assessed' as const, applicability: 'under_review' as const, reason: 'Specific source export is missing for this check.' };
  expect(prepareCompletionChecks([original], 'A shared explanation for other pending checks.').checks[0].reason).toBe(original.reason);
  const excluded = { ...original, implementation_status: 'not_applicable' as const, applicability: 'no' as const, result: 'not_applicable' as const, reason: '' };
  expect(prepareCompletionChecks([excluded], 'The source evidence has not been supplied.').error).toContain('Explain checklist item');
});
