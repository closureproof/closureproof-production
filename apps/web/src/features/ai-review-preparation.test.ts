import { expect, it } from 'vitest';
import { prepareAIReview } from './ai-review-preparation';
import type { AIReviewOutput, ProposalFact } from '../lib/ai-review-contract';
import type { ManualFinding } from '../lib/manual-api';
const fact: ProposalFact = {
  key: 'run:0',
  runId: 'run',
  index: 0,
  evidenceId: 'evidence',
  version: 1,
  sha256: 'a'.repeat(64),
  filename: 'source.pdf',
  label: 'Population',
  value: '121 reviewed accounts',
  quote: '121 accounts were reviewed.',
  locator: 'Review summary',
  page: 1,
};
const finding = {
  protocol: {
    code: 'aws-iam',
    checks: [
      { id: 'iso-ACC-08', label: 'Privileged activity', guidance: 'Inspect evidence' },
      { id: 'iso-DOC-12', label: 'Logs', guidance: 'Inspect logs' },
    ],
  },
} as unknown as Pick<ManualFinding, 'protocol'>;
function output(): AIReviewOutput {
  return {
    checklist: [
      {
        check_id: 'iso-ACC-08',
        applicability: 'yes',
        implementation_status: 'partially_implemented',
        rationale: 'The source establishes only part of the inspected record.',
        source_refs: ['run:0'],
      },
    ],
    engine: [
      {
        field_id: 'scope',
        value: 'true',
        rationale: 'The source records identify the relevant scope and baseline.',
        source_refs: ['run:0'],
      },
    ],
    judgements: [{ field: 'scope_status', value: 'Gaps identified', source_refs: ['run:0'] }],
    population: { expected: null, reviewed: 121, source_refs: ['run:0'] },
    exceptions: [],
    summary: 'The reviewed population is recorded; complete coverage is not established.',
    next_actions: 'Supply the authoritative complete population and baseline.',
    limitations: [],
    conflicts: [],
  };
}
it('prepares exact pinned fields with source IDs, filenames and locators without inferring full coverage', () => {
  const result = prepareAIReview(output(), finding, [fact]);
  expect(result.checks[0]).toMatchObject({
    implementation_status: 'partially_implemented',
    evidence_ids: ['evidence'],
  });
  expect(result.checks[0].source_location).toContain('source.pdf: page 1');
  expect(result.checks[1]).toMatchObject({
    implementation_status: 'not_assessed',
    result: 'unknown',
  });
  expect(result.engine.entries.scope).toMatchObject({ value: 'true', evidenceIds: ['evidence'] });
  expect(result.engine.entries.coverage).toBeUndefined();
  expect(result.expected).toBeNull();
  expect(result.reviewed).toBe(121);
});
it('rejects unknown references, out-of-scope controls and unknown engine fields', () => {
  const bad = output();
  bad.engine[0].source_refs = ['invented'];
  expect(() => prepareAIReview(bad, finding, [fact])).toThrow('unknown source');
  const control = output();
  control.checklist[0].check_id = 'outside-scope';
  expect(() => prepareAIReview(control, finding, [fact])).toThrow('out-of-scope');
  const engine = output();
  engine.engine[0].field_id = 'invented';
  expect(() => prepareAIReview(engine, finding, [fact])).toThrow('unknown');
});
it('never accepts established or excluded checklist results without citations and consistent applicability', () => {
  const missing = output();
  missing.checklist[0].source_refs = [];
  const unresolved = prepareAIReview(missing, finding, [fact]);
  expect(unresolved.checks[0]).toMatchObject({
    implementation_status: 'not_assessed',
    source_location: '',
    evidence_ids: [],
  });
  expect(unresolved.sourceWarnings.length).toBeGreaterThan(0);
  const inconsistent = output();
  inconsistent.checklist[0].implementation_status = 'implemented';
  inconsistent.checklist[0].applicability = 'no';
  expect(() => prepareAIReview(inconsistent, finding, [fact])).toThrow('inconsistent');
});
it('keeps unknowns explicit and rejects AI readiness verdicts', () => {
  const unknown = output();
  unknown.engine[0].value = null;
  unknown.engine[0].source_refs = [];
  unknown.judgements[0] = { field: 'scope_status', value: 'Not yet established', source_refs: [] };
  expect(prepareAIReview(unknown, finding, [fact]).engine.entries.scope.value).toBe('');
  expect(() =>
    prepareAIReview({ ...unknown, recommendation: 'closure_ready' }, finding, [fact]),
  ).toThrow();
});
it('conflicting extractions cannot automatically establish successful results', () => {
  const conflict = output();
  conflict.checklist[0].implementation_status = 'implemented';
  conflict.conflicts = ['Different extracts give incompatible population counts.'];
  const result = prepareAIReview(conflict, finding, [fact]);
  expect(result.checks[0].implementation_status).toBe('not_assessed');
  expect(result.engine.entries.scope.value).toBe('');
  expect(result.judgement.scope_status).toBe('Not yet established');
  expect(result.reviewed).toBeNull();
});
it('preserves exact numbers and validates typed dates rather than parsing narrative guesses', () => {
  const invalid = output();
  invalid.engine[0] = {
    field_id: 'required_days',
    value: 'ninety',
    rationale: 'An invalid proposal must not become a protocol requirement.',
    source_refs: ['run:0'],
  };
  expect(() => prepareAIReview(invalid, finding, [fact])).toThrow('typed');
});

it('keeps valid citations while leaving uncited claims unknown', () => {
  const value = output();
  value.engine[0].source_refs = [];
  value.judgements[0].source_refs = [];
  value.population.source_refs = [];
  const result = prepareAIReview(value, finding, [fact]);
  expect(result.engine.entries.scope.value).toBe('');
  expect(result.judgement.scope_status).toBe('Not yet established');
  expect(result.reviewed).toBeNull();
  expect(result.checks[0].source_location).toContain('source.pdf');
  expect(result.sourceWarnings.length).toBeGreaterThan(0);
});

it('preserves more than twenty cited facts across evidence documents', () => {
  const facts = Array.from({ length: 35 }, (_, index) => ({
    ...fact,
    key: 'run:' + index,
    index,
    evidenceId: index < 20 ? 'evidence-a' : 'evidence-b',
    filename: index < 20 ? 'first.pdf' : 'second.docx',
  }));
  const proposed = output();
  proposed.checklist[0].source_refs = facts.map((fact) => fact.key);
  const prepared = prepareAIReview(proposed, finding, facts);
  expect(prepared.sourceKeys).toHaveLength(35);
  expect(prepared.checks[0].evidence_ids).toEqual(['evidence-a', 'evidence-b']);
});
it('keeps contradictory exception answers unresolved rather than discarding the entire draft', () => {
  const proposed = output();
  proposed.judgements.push({
    field: 'exceptions_status',
    value: 'None identified',
    source_refs: ['run:0'],
  });
  proposed.exceptions = [
    {
      reference: 'EX-1',
      description: 'An exception needs additional supporting records.',
      owner: 'IT owner',
      disposition: 'open',
      evidence_reference: 'source.pdf',
      closure_impact: 'Unresolved evidence requires review.',
      source_refs: ['run:0'],
    },
  ];
  const prepared = prepareAIReview(proposed, finding, [fact]);
  expect(prepared.engine.entries.scope.value).toBe('');
  expect(prepared.judgement.exceptions_status).toBe('Not yet established');
  expect(prepared.exceptions).toHaveLength(1);
  expect(prepared.sourceWarnings.join(' ')).toContain('disagree');
});
