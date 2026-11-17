import { CHECKLIST_MAPPING_VERSION, awsIamChecklistMappings } from './checklist-mapping';
import { z } from 'zod';
import { dateSchema, protocolSchema, type Protocol } from './contracts';

// Founder-requested first integrated protocol. Candidate method; not independently validated.
export const AWS_IAM_VERSION = '0.2.0-checklist-candidate';
export const assessmentFields = [
  { id: 'scope', label: 'Scope and approved access baseline are established', type: 'boolean' },
  { id: 'implemented', label: 'Corrective action is implemented', type: 'boolean' },
  { id: 'cause', label: 'Action addresses the root cause and recurrence', type: 'boolean' },
  { id: 'evidence', label: 'Evidence is relevant, reliable and sufficient', type: 'boolean' },
  { id: 'coverage', label: 'Affected identities, resources and access paths are reconciled', type: 'boolean' },
  { id: 'exceptions', label: 'Exceptions are resolved or have documented acceptable treatment', type: 'boolean' },
  { id: 'operation_required', label: 'Operating-history assessment is required', type: 'boolean' },
  { id: 'operation_start', label: 'Confirmed effective-operation start', type: 'date', conditional: 'operation_required' },
  { id: 'operation_end', label: 'Operating evidence covers through', type: 'date', conditional: 'operation_required' },
  { id: 'required_days', label: 'Required operating days (record rationale)', type: 'integer', conditional: 'operation_required' },
  { id: 'required_cycles', label: 'Required operating cycles (record rationale)', type: 'integer', conditional: 'operation_required' },
  { id: 'observed_cycles', label: 'Evidenced operating cycles', type: 'integer', conditional: 'operation_required' },
  { id: 'retest_required', label: 'Independent retest is required', type: 'boolean' },
  { id: 'retest', label: 'Independent retest assessment', type: 'retest', conditional: 'retest_required' },
  { id: 'deadline', label: 'Confirmed finding deadline (optional)', type: 'date' },
] as const;
export const engineEntrySchema = z.object({ value: z.string().max(200), basis: z.string().max(2000), evidenceIds: z.array(z.string().uuid()).max(30), locator: z.string().max(500) }).strict();
export const engineDraftSchema = z.object({ version: z.enum(['0.1.0-candidate', AWS_IAM_VERSION, '0.3.0-checklist-candidate', '0.1.0-checklist-candidate']), protocolCode:z.string().min(1).max(100).optional(), entries: z.record(z.string(), engineEntrySchema), dateDecisions:z.record(z.string(),z.object({value:dateSchema,reason:z.string().max(2000),candidates:z.array(z.object({value:dateSchema,source:z.string().max(1000)}))}).strict()).optional() }).strict();
export type EngineDraft = z.infer<typeof engineDraftSchema>;
export const emptyEngineDraft = (): EngineDraft => ({ version: AWS_IAM_VERSION, entries: {} });
export const recommendationLabels = {
  not_closure_ready: 'Not closure ready', implemented_evidence_incomplete: 'Implemented but evidence incomplete', ready_for_retest: 'Ready for retest', closure_ready: 'Closure ready',
} as const;

const rule = (id: string, label: string): Protocol['rules'][number] => ({ id, label, mandatory: true, predicate: { operator: 'equals', fact: id, value: true }, metReason: `${label}: confirmed by reviewer with evidence.`, unmetReason: `${label}: reviewer identified a gap.`, unknownReason: `${label}: not established with current confirmed evidence.` });
const rules: Protocol['rules'] = ['scope', 'implemented', 'cause', 'evidence', 'coverage', 'exceptions'].map(id => rule(id, assessmentFields.find(field => field.id === id)!.label));
const operationApplicability = { fact: 'operation_required', equals: true, exclusionReason: 'Reviewer recorded that operating history is not required, with supporting basis.' };
rules.push(
  { ...rule('period', 'Required operating period is evidenced'), predicate: { operator: 'observed_days', fact: 'operation_start', endFact: 'operation_end', daysFact: 'required_days' }, applicableWhen: operationApplicability },
  { ...rule('cycles', 'Required operating cycles are evidenced'), predicate: { operator: 'at_least_fact', fact: 'observed_cycles', otherFact: 'required_cycles' }, applicableWhen: operationApplicability },
  { ...rule('retest', 'Required independent retest supports remediation'), predicate: { operator: 'equals', fact: 'retest', value: 'satisfactory' }, applicableWhen: { fact: 'retest_required', equals: true, exclusionReason: 'Reviewer recorded that an independent retest is not required, with supporting basis.' } },
  { ...rule('retest_pending', 'Required retest remains pending'), mandatory: false, predicate: { operator: 'equals', fact: 'retest', value: 'pending' }, applicableWhen: { fact: 'retest_required', equals: true, exclusionReason: 'Retest is not required for this assessment.' } },
);
const prerequisiteConditions = rules.filter(item => item.mandatory && item.id !== 'retest').map(item => ({ rule: item.id, statuses: ['met', 'excluded'] as ('met' | 'excluded')[] }));
export const awsIamCandidate = protocolSchema.parse({
  code: 'aws-iam', title: 'AWS IAM privileged-access closure readiness', version: AWS_IAM_VERSION, author: 'ClosureProof product method',
  rationale: 'Checklist-linked candidate: pinned ISO checklist assessments are required alongside closure-specific facts. Assesses finding-specific remediation using confirmed evidence and reviewer judgements. No universal operating period, audit pass/fail or live AWS verification is implied. Independent method validation remains pending.',
  hitPolicy: 'explicit_priority',
  checklistPolicy: {version:CHECKLIST_MAPPING_VERSION, mappings:awsIamChecklistMappings},
  facts: assessmentFields.map(field => ({ id: field.id, label: field.label, type: field.type === 'retest' ? 'text' : field.type })),
  rules,
  decisions: [
    ...['scope', 'implemented', 'cause'].map((id, priority) => ({ id: `unremediated-${id}`, priority, recommendation: 'not_closure_ready', reason: 'A confirmed scope, implementation or cause/action requirement remains unmet.', when: [{ rule: id, statuses: ['unmet'] }] })),
    { id: 'failed-retest', priority: 3, recommendation: 'not_closure_ready', reason: 'The required independent retest did not support effective remediation.', when: [{ rule: 'retest', statuses: ['unmet'] }, { rule: 'retest_pending', statuses: ['unmet'] }] },
    // Only label evidence incomplete where implementation is explicitly established.
    ...rules.filter(item => item.mandatory && !['scope', 'implemented', 'cause', 'retest'].includes(item.id)).map((item, index) => ({ id: `incomplete-${item.id}`, priority: 10 + index, recommendation: 'implemented_evidence_incomplete', reason: 'Implementation is established but evidence, coverage, exceptions or operating history is incomplete.', when: [{ rule: 'implemented', statuses: ['met'] }, { rule: item.id, statuses: ['unmet', 'unknown'] }] })),
    { id: 'pending-retest', priority: 30, recommendation: 'ready_for_retest', reason: 'All other applicable prerequisites are met; the required independent retest remains pending.', when: [...prerequisiteConditions, { rule: 'retest_pending', statuses: ['met'] }] },
    { id: 'ready', priority: 40, recommendation: 'closure_ready', reason: 'All mandatory applicable requirements are satisfied by the recorded reviewer-confirmed basis.', when: [...prerequisiteConditions, { rule: 'retest', statuses: ['met', 'excluded'] }] },
  ],
  timing: { rule: 'period', deadlineFact: 'deadline', rationale: 'Required days and cycles are explicitly recorded by the reviewer with a finding-specific rationale. UTC calendar dates, start plus required days; no ISO-wide default.' },
});
