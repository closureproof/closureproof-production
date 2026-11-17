import { CHECKLIST_MAPPING_VERSION, awsIamChecklistMappings } from './checklist-mapping';
import { protocolSchema } from './contracts';
import { assessmentFields as commonFields, type EngineDraft } from './review-contracts';
import { commonReadinessRules, commonReadinessDecisions } from './readiness-rules';

// Compatibility exports for earlier integrations. New callers use review-contracts.
export { engineEntrySchema, engineDraftSchema, recommendationLabels, type EngineDraft } from './review-contracts';
// Candidate method; not independently validated. Preserve historical labels/version.
export const AWS_IAM_VERSION = '0.2.0-checklist-candidate';
export const assessmentFields = commonFields.map(field => ({ ...field, label:
  field.id === 'scope' ? 'Scope and approved access baseline are established' :
  field.id === 'coverage' ? 'Affected identities, resources and access paths are reconciled' : field.label }));
export const emptyEngineDraft = (): EngineDraft => ({ version: AWS_IAM_VERSION, entries: {} });
const rules = commonReadinessRules(assessmentFields);
export const awsIamCandidate = protocolSchema.parse({
  code: 'aws-iam', title: 'AWS IAM privileged-access closure readiness', version: AWS_IAM_VERSION, author: 'ClosureProof product method',
  rationale: 'Checklist-linked candidate: pinned ISO checklist assessments are required alongside closure-specific facts. Assesses finding-specific remediation using confirmed evidence and reviewer judgements. No universal operating period, audit pass/fail or live AWS verification is implied. Independent method validation remains pending.',
  hitPolicy: 'explicit_priority',
  checklistPolicy: {version:CHECKLIST_MAPPING_VERSION, mappings:awsIamChecklistMappings},
  facts: assessmentFields.map(field => ({ id: field.id, label: field.label, type: field.type === 'retest' ? 'text' : field.type })),
  rules,
  decisions: commonReadinessDecisions(rules),
  timing: { rule: 'period', deadlineFact: 'deadline', rationale: 'Required days and cycles are explicitly recorded by the reviewer with a finding-specific rationale. UTC calendar dates, start plus required days; no ISO-wide default.' },
});
