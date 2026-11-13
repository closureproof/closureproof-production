// Node-only publication tooling. Approval records must come from a trusted release process,
// never browser input. These records are traceability, not identity verification.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { assessmentInputSchema, dateSchema, protocolSchema, recommendations, type AssessmentInput, type Protocol, type Recommendation, type RuleStatus } from './contracts';
import { evaluateDraftProtocol } from './index';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export const contentHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export interface ValidationCase {
  id: string;
  input: AssessmentInput;
  expectedRecommendation: Recommendation | null;
  expectedRules: Record<string, RuleStatus>;
  expectedWarnings: ('deadline_conflict' | 'timing_unavailable')[];
}
export function validateCandidate(definition: Protocol, fixtures: ValidationCase[]) {
  const protocol = protocolSchema.parse(definition);
  const seen = new Set<string>();
  const cases = fixtures.map(fixture => {
    if (!fixture.id || seen.has(fixture.id)) throw new Error('Validation case IDs must be present and unique.');
    seen.add(fixture.id);
    const result = evaluateDraftProtocol(protocol, fixture.input);
    const actualRules = Object.fromEntries(result.rules.map(rule => [rule.id, rule.status]));
    const expectedRuleKeys = Object.keys(fixture.expectedRules).sort();
    const completeTrace = canonical(expectedRuleKeys) === canonical(Object.keys(actualRules).sort());
    const passed = completeTrace && result.recommendation === fixture.expectedRecommendation
      && canonical(actualRules) === canonical(fixture.expectedRules)
      && canonical(result.warnings.map(warning => warning.code).sort()) === canonical([...fixture.expectedWarnings].sort());
    return { id: fixture.id, passed, result };
  });
  const missingOutcomes = recommendations.filter(outcome => !cases.some(item => item.passed && item.result.recommendation === outcome));
  const missingBoundaries: string[] = [];
  for (const rule of protocol.rules) {
    for (const status of ['met', 'unmet', 'unknown', ...(rule.applicableWhen ? ['excluded'] : [])]) {
      if (!cases.some(item => item.passed && item.result.rules.some(result => result.id === rule.id && result.status === status))) missingBoundaries.push(`${rule.id}:${status}`);
    }
  }
  if (protocol.timing) for (const warning of ['deadline_conflict', 'timing_unavailable']) {
    if (!cases.some(item => item.passed && item.result.warnings.some(result => result.code === warning))) missingBoundaries.push(warning);
  }
  return { protocolHash: contentHash(protocol), fixtureHash: contentHash(fixtures), passed: cases.length > 0 && cases.every(item => item.passed) && !missingOutcomes.length && !missingBoundaries.length, missingOutcomes, missingBoundaries, cases };
}
const approvalSchema = z.object({
  protocolHash: z.string().regex(/^[a-f0-9]{64}$/), fixtureHash: z.string().regex(/^[a-f0-9]{64}$/),
  role: z.enum(['product_owner', 'independent_reviewer']), reviewer: z.string().trim().min(2), reviewedOn: dateSchema,
  reference: z.string().trim().min(10), conclusion: z.literal('approved'),
}).strict();
export type ProtocolApproval = z.infer<typeof approvalSchema>;
export interface PublishedProtocol {
  definition: Protocol; fixtures: ValidationCase[]; approvals: ProtocolApproval[]; publishedOn: string;
  protocolHash: string; fixtureHash: string;
}
/** Creates a release artefact only after tests and recorded reviews; does not persist or authorise a release. */
export function preparePublication(definition: Protocol, fixtures: ValidationCase[], approvals: ProtocolApproval[], publishedOn: string): PublishedProtocol {
  dateSchema.parse(publishedOn);
  const protocol = protocolSchema.parse(definition);
  const validation = validateCandidate(protocol, fixtures);
  if (!validation.passed) throw new Error('The protocol validation matrix is incomplete or has failing cases.');
  const records = z.array(approvalSchema).length(2).parse(approvals);
  const normalise = (name: string) => name.trim().toLowerCase();
  if (new Set(records.map(record => record.role)).size !== 2 || new Set(records.map(record => normalise(record.reviewer))).size !== 2) throw new Error('Separate product-owner and independent-reviewer approvals are required.');
  for (const record of records) {
    if (record.protocolHash !== validation.protocolHash || record.fixtureHash !== validation.fixtureHash || record.reviewedOn > publishedOn) throw new Error('Approval does not match the protocol, fixtures or publication date.');
    if (record.role === 'independent_reviewer' && normalise(record.reviewer) === normalise(protocol.author)) throw new Error('The protocol author cannot supply the independent review.');
  }
  // Detach caller-owned objects so later authoring changes cannot mutate this release artefact.
  return structuredClone({ definition: protocol, fixtures, approvals: records, publishedOn, protocolHash: validation.protocolHash, fixtureHash: validation.fixtureHash });
}
export function evaluatePublishedProtocol(release: PublishedProtocol, input: AssessmentInput, expectedProtocolHash: string) {
  const verified = preparePublication(release.definition, release.fixtures, release.approvals, release.publishedOn);
  if (expectedProtocolHash !== verified.protocolHash || release.protocolHash !== verified.protocolHash || release.fixtureHash !== verified.fixtureHash) throw new Error('Pinned protocol content does not match its validated release.');
  const assessment = assessmentInputSchema.parse(input);
  if (assessment.evaluationDate < release.publishedOn) throw new Error('The protocol was not published at the evaluation date.');
  const result = evaluateDraftProtocol(verified.definition, assessment);
  return { ...result, mode: 'rules_supported' as const, protocolHash: verified.protocolHash, fixtureHash: verified.fixtureHash, publicationDate: release.publishedOn, inputHash: contentHash(assessment), traceHash: contentHash(result) };
}
