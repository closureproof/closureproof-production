import { initialiseSoaCheck, soaCheckLabel, validateSoaChecks } from './soa-assessment';

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
