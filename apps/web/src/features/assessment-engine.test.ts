// Synthetic engineering rules only; these fixtures are not ClosureProof closure protocols.
import { describe, expect, it } from 'vitest';
import { evaluateDraftProtocol, protocolSchema, type AssessmentInput, type Protocol } from '../../../../packages/assessment-engine/src';
import { contentHash, evaluatePublishedProtocol, preparePublication, validateCandidate, type ValidationCase } from '../../../../packages/assessment-engine/src/publication';

const sha256 = 'a'.repeat(64);
const source = { evidenceId: 'e1', version: 1, sha256, locator: 'Synthetic test record, section 1' };
const fact = (value: boolean | string | number) => ({ state: 'confirmed' as const, value, confirmedBy: 'Test reviewer', confirmedOn: '2026-11-11', basis: 'Synthetic fixture only', sources: [source] });
const unknown = { state: 'unknown' as const, reason: 'Not established in the supplied record' };
const definition = (): Protocol => protocolSchema.parse({
  code: 'synthetic-only', title: 'Software test protocol — not a product policy', version: 'test-1', author: 'Test author', rationale: 'Exercises the evaluator; not approved security criteria.', hitPolicy: 'explicit_priority',
  facts: ['implementation', 'evidence', 'retest_required', 'retest'].map(id => ({ id, label: id, type: 'boolean' })),
  rules: ['implementation', 'evidence', 'retest'].map(id => ({ id, label: id, mandatory: true, predicate: { operator: 'equals', fact: id, value: true }, ...(id === 'retest' ? { applicableWhen: { fact: 'retest_required', equals: true, exclusionReason: 'Reviewer confirmed this synthetic rule is excluded.' } } : {}), metReason: 'Confirmed test requirement met.', unmetReason: 'Confirmed test requirement not met.', unknownReason: 'A current confirmed fact is required.' })),
  decisions: [
    { id: 'action', priority: 0, recommendation: 'not_closure_ready', reason: 'Synthetic action is not implemented.', when: [{ rule: 'implementation', statuses: ['unmet'] }] },
    ...['implementation', 'evidence', 'retest'].map((rule, i) => ({ id: `unknown-${rule}`, priority: i + 1, recommendation: 'implemented_evidence_incomplete', reason: 'Synthetic facts are incomplete.', when: [{ rule, statuses: ['unknown'] }] })),
    { id: 'evidence', priority: 4, recommendation: 'implemented_evidence_incomplete', reason: 'Synthetic evidence is incomplete.', when: [{ rule: 'evidence', statuses: ['unmet'] }] },
    { id: 'retest', priority: 5, recommendation: 'ready_for_retest', reason: 'Only the synthetic retest remains.', when: [{ rule: 'implementation', statuses: ['met'] }, { rule: 'evidence', statuses: ['met'] }, { rule: 'retest', statuses: ['unmet'] }] },
    { id: 'ready', priority: 6, recommendation: 'closure_ready', reason: 'Synthetic requirements met.', when: [{ rule: 'implementation', statuses: ['met'] }, { rule: 'evidence', statuses: ['met'] }, { rule: 'retest', statuses: ['met', 'excluded'] }] },
  ],
});
const input = (): AssessmentInput => ({ findingId: 'synthetic-finding', findingRevision: 2, scopeRevision: 1, evaluationDate: '2026-11-11', checklist:{definitions:[{id:'iso-ACC-08',label:'Service accounts'}],answers:[{check_id:'iso-ACC-08',result:'pass',applicability:'yes',implementation_status:'implemented',reason:'Reviewer inspected the policy evidence.',evidence_ids:['e1'],source_location:'Section 1'}]}, evidence: [{ id: 'e1', version: 1, sha256 }], facts: { implementation: fact(true), evidence: fact(true), retest_required: fact(true), retest: fact(true) } });
function matrix(): ValidationCase[] {
  const cases: ValidationCase[] = [];
  for (const [key, value, recommendation] of [
    ['implementation', false, 'not_closure_ready'], ['evidence', false, 'implemented_evidence_incomplete'], ['retest', false, 'ready_for_retest'], ['retest_required', false, 'closure_ready'],
    ['implementation', null, 'implemented_evidence_incomplete'], ['evidence', null, 'implemented_evidence_incomplete'], ['retest', null, 'implemented_evidence_incomplete'], ['none', true, 'closure_ready'],
  ] as const) {
    const assessment = input();
    if (key !== 'none') assessment.facts[key] = value === null ? unknown : fact(value);
    const expectedRules: ValidationCase['expectedRules'] = { implementation: 'met', evidence: 'met', retest: 'met' };
    if (key === 'retest_required') expectedRules.retest = 'excluded';
    else if (key !== 'none') expectedRules[key] = value === null ? 'unknown' : 'unmet';
    cases.push({ id: `${key}-${value}`, input: assessment, expectedRecommendation: recommendation, expectedRules, expectedWarnings: [] });
  }
  return cases;
}

describe('assessment evaluator foundation', () => {
  it('reproduces all four outcomes and complete traces without mutating input', () => {
    const protocol = definition(); const assessment = input(); const before = structuredClone(assessment);
    expect(validateCandidate(protocol, matrix()).passed).toBe(true);
    expect(evaluateDraftProtocol(protocol, assessment)).toEqual(evaluateDraftProtocol(protocol, assessment));
    expect(assessment).toEqual(before);
    expect(evaluateDraftProtocol(protocol, assessment).mode).toBe('draft');
  });
  it('does not turn absent facts or missing evidence into satisfied requirements', () => {
    const assessment = input(); delete assessment.facts.evidence;
    expect(evaluateDraftProtocol(definition(), assessment).missingFacts).toContain('evidence');
    assessment.evidence = [];
    expect(evaluateDraftProtocol(definition(), assessment).rules.every(rule => rule.status === 'unknown')).toBe(true);
  });
  it('rejects stale source versions, checksums and future confirmations as usable facts', () => {
    for (const change of ['version', 'checksum', 'date']) {
      const assessment = input();
      if (change === 'version') assessment.evidence[0].version = 2;
      if (change === 'checksum') assessment.evidence[0].sha256 = 'b'.repeat(64);
      if (change === 'date') assessment.evaluationDate = '2026-11-10';
      expect(evaluateDraftProtocol(definition(), assessment).rules.every(rule => rule.status === 'unknown')).toBe(true);
    }
  });
  it('requires a confirmed exclusion decision and distinguishes unknown applicability', () => {
    const assessment = input(); assessment.facts.retest_required = unknown;
    expect(evaluateDraftProtocol(definition(), assessment).rules[2].status).toBe('unknown');
    assessment.facts.retest_required = fact(false); delete assessment.facts.retest;
    expect(evaluateDraftProtocol(definition(), assessment).rules[2].status).toBe('excluded');
  });
  it('retains every matching case and every failed rule when issues overlap', () => {
    const assessment = input(); assessment.facts.implementation = fact(false); assessment.facts.evidence = fact(false);
    const result = evaluateDraftProtocol(definition(), assessment);
    expect(result.recommendation).toBe('not_closure_ready');
    expect(result.matchedDecisionIds).toEqual(['action', 'evidence']);
    expect(result.rules.filter(rule => rule.status === 'unmet')).toHaveLength(2);
  });
  it('blocks ambiguous unique tables and incomplete decision tables', () => {
    const protocol = definition(); protocol.hitPolicy = 'unique'; protocol.decisions[0].when = [{ rule: 'implementation', statuses: ['met'] }];
    expect(evaluateDraftProtocol(protocol, input()).recommendation).toBeNull();
    protocol.decisions = [definition().decisions[0]];
    expect(evaluateDraftProtocol(protocol, input()).recommendation).toBeNull();
  });
  it('blocks closure-ready results that ignore mandatory unknown or unmet rules', () => {
    const protocol = definition(); protocol.decisions = [{ ...protocol.decisions.at(-1)!, when: [{ rule: 'implementation', statuses: ['met'] }] }];
    for (const value of [fact(false), unknown]) {
      const assessment = input(); assessment.facts.evidence = value;
      expect(evaluateDraftProtocol(protocol, assessment).recommendation).toBeNull();
    }
  });
  it('does not coerce string booleans or numbers', () => {
    const assessment = input(); assessment.facts.implementation = fact('true');
    expect(evaluateDraftProtocol(definition(), assessment).rules[0].status).toBe('unknown');
  });
  it('rejects malformed definitions, unknown input keys and duplicate evidence IDs', () => {
    const protocol = definition(); protocol.rules[0].predicate.fact = 'missing';
    expect(() => evaluateDraftProtocol(protocol, input())).toThrow();
    const assessment = input(); assessment.facts.extra = fact(true);
    expect(() => evaluateDraftProtocol(definition(), assessment)).toThrow('Unrecognised fact');
    delete assessment.facts.extra; assessment.evidence.push(assessment.evidence[0]);
    expect(() => evaluateDraftProtocol(definition(), assessment)).toThrow('unique');
  });
  it('uses an explicit date convention, preserves cycles and reports deadline conflicts', () => {
    const protocol = definition();
    protocol.facts.push({ id: 'start', label: 'Start', type: 'date' }, { id: 'deadline', label: 'Deadline', type: 'date' }, { id: 'cycles', label: 'Cycles', type: 'integer' });
    protocol.rules.push({ ...protocol.rules[0], id: 'period', predicate: { operator: 'elapsed_days', fact: 'start', days: 90, convention: 'utc_date_plus_days' } }, { ...protocol.rules[0], id: 'cycles', predicate: { operator: 'at_least', fact: 'cycles', value: 2 } });
    protocol.timing = { rule: 'period', deadlineFact: 'deadline', rationale: 'Synthetic business-plan timing example, not an ISO duration.' };
    const assessment = input(); assessment.facts.start = fact('2026-09-20'); assessment.facts.deadline = fact('2026-11-30'); assessment.facts.cycles = fact(1);
    const result = evaluateDraftProtocol(protocol, assessment);
    expect(result.warnings[0]).toMatchObject({ code: 'deadline_conflict', earliestDate: '2026-12-19' });
    assessment.evaluationDate = '2026-12-19';
    const later = evaluateDraftProtocol(protocol, assessment);
    expect(later.rules.find(rule => rule.id === 'period')?.status).toBe('met');
    expect(later.rules.find(rule => rule.id === 'cycles')?.status).toBe('unmet');
    expect(later.recommendation).toBeNull();
    delete assessment.facts.deadline;
    expect(evaluateDraftProtocol(protocol, assessment).warnings[0].code).toBe('timing_unavailable');
  });
  it('checks date boundaries and numeric cross-fact comparisons', () => {
    const protocol = definition(); protocol.facts.push({ id: 'expected', label: 'Expected', type: 'integer' }, { id: 'reviewed', label: 'Reviewed', type: 'integer' });
    protocol.rules.push({ ...protocol.rules[0], id: 'coverage', predicate: { operator: 'at_least_fact', fact: 'reviewed', otherFact: 'expected' } });
    const assessment = input(); assessment.facts.expected = fact(126); assessment.facts.reviewed = fact(121);
    expect(evaluateDraftProtocol(protocol, assessment).rules.at(-1)?.status).toBe('unmet');
    assessment.evaluationDate = '2026-02-30';
    expect(() => evaluateDraftProtocol(protocol, assessment)).toThrow();
  });
});

describe('protocol publication tooling', () => {
  const approvals = () => {
    const validation = validateCandidate(definition(), matrix());
    return (['product_owner', 'independent_reviewer'] as const).map((role, i) => ({ protocolHash: validation.protocolHash, fixtureHash: validation.fixtureHash, role, reviewer: `Synthetic reviewer ${i}`, reviewedOn: '2026-11-11', reference: 'Synthetic review reference only', conclusion: 'approved' as const }));
  };
  it('blocks incomplete or failing validation matrices', () => {
    expect(() => preparePublication(definition(), [], approvals(), '2026-11-11')).toThrow('incomplete');
    const fixtures = matrix(); fixtures[0].expectedRecommendation = 'closure_ready';
    expect(validateCandidate(definition(), fixtures).passed).toBe(false);
  });
  it('requires separate, matching review records and rejects author self-review', () => {
    const records = approvals(); records[1].reviewer = definition().author;
    expect(() => preparePublication(definition(), matrix(), records, '2026-11-11')).toThrow('author');
    records[1] = { ...approvals()[1], protocolHash: 'b'.repeat(64) };
    expect(() => preparePublication(definition(), matrix(), records, '2026-11-11')).toThrow('does not match');
  });
  it('pins protocol, fixtures and assessment hashes; detects release edits', () => {
    const release = preparePublication(definition(), matrix(), approvals(), '2026-11-11');
    const result = evaluatePublishedProtocol(release, input(), release.protocolHash);
    expect(result.mode).toBe('rules_supported');
    expect(result.inputHash).toBe(contentHash(input()));
    expect(() => evaluatePublishedProtocol(release, input(), 'b'.repeat(64))).toThrow('Pinned');
    release.definition.rationale = 'Changed after review';
    expect(() => evaluatePublishedProtocol(release, input(), release.protocolHash)).toThrow();
  });
});

describe('first integrated AWS IAM candidate', () => {
  it('requires confirmed implementation and does not invent an operating duration', async () => {
    const { awsIamCandidate }=await import('../../../../packages/assessment-engine/src/aws-iam');
    const assessment=input();assessment.facts={};
    for(const key of ['scope','implemented','cause','evidence','coverage','exceptions'])assessment.facts[key]=fact(true);
    assessment.facts.operation_required=fact(false);assessment.facts.retest_required=fact(false);
    expect(evaluateDraftProtocol(awsIamCandidate,assessment).recommendation).toBe('closure_ready');
    assessment.facts.implemented=unknown;
    expect(evaluateDraftProtocol(awsIamCandidate,assessment).recommendation).toBeNull();
    assessment.facts.implemented=fact(false);
    expect(evaluateDraftProtocol(awsIamCandidate,assessment).recommendation).toBe('not_closure_ready');
  });
  it('distinguishes an outstanding retest from a failed retest and retains evidence gaps', async () => {
    const { awsIamCandidate }=await import('../../../../packages/assessment-engine/src/aws-iam');
    const assessment=input();assessment.facts={};
    for(const key of ['scope','implemented','cause','evidence','coverage','exceptions'])assessment.facts[key]=fact(true);
    assessment.facts.operation_required=fact(false);assessment.facts.retest_required=fact(true);assessment.facts.retest=fact('pending');
    expect(evaluateDraftProtocol(awsIamCandidate,assessment).recommendation).toBe('ready_for_retest');
    assessment.facts.evidence=fact(false);
    expect(evaluateDraftProtocol(awsIamCandidate,assessment).recommendation).toBe('implemented_evidence_incomplete');
    assessment.facts.retest=fact('unsatisfactory');
    expect(evaluateDraftProtocol(awsIamCandidate,assessment).recommendation).toBe('not_closure_ready');
  });
  it('requires actual operating evidence through the required period, not time passing', async () => {
    const { awsIamCandidate }=await import('../../../../packages/assessment-engine/src/aws-iam');
    const assessment=input();assessment.evaluationDate='2026-12-20';assessment.facts={};
    for(const key of ['scope','implemented','cause','evidence','coverage','exceptions'])assessment.facts[key]=fact(true);
    assessment.facts.operation_required=fact(true);assessment.facts.retest_required=fact(false);
    assessment.facts.operation_start=fact('2026-09-20');assessment.facts.operation_end=fact('2026-11-01');assessment.facts.required_days=fact(90);assessment.facts.required_cycles=fact(2);assessment.facts.observed_cycles=fact(1);assessment.facts.deadline=fact('2026-11-30');
    const result=evaluateDraftProtocol(awsIamCandidate,assessment);
    expect(result.recommendation).toBe('implemented_evidence_incomplete');
    expect(result.rules.find(rule=>rule.id==='period')?.status).toBe('unmet');
    expect(result.warnings[0]).toMatchObject({code:'deadline_conflict',earliestDate:'2026-12-19'});
    assessment.facts.operation_end=fact('2026-12-19');assessment.facts.observed_cycles=fact(2);
    expect(evaluateDraftProtocol(awsIamCandidate,assessment).recommendation).toBe('closure_ready');
  });
});

it('finding-date context cannot establish a remediation or effectiveness fact',()=>{
 const assessment=input();assessment.findingContext={id:assessment.findingId,revision:assessment.findingRevision,sha256,deadline:'2026-11-30'};
 assessment.facts.implementation={...fact(true),sources:[{kind:'finding',evidenceId:assessment.findingId,version:assessment.findingRevision,sha256,locator:'Finding details'}]};
 expect(evaluateDraftProtocol(definition(),assessment).rules.find(rule=>rule.id==='implementation')?.status).toBe('unknown');
});
