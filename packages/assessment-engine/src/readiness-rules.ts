import { protocolSchema, type Protocol } from './contracts';

// Common closure prerequisites, independent of any cloud provider. Each protocol
// supplies its own labels, checklist mappings and additional domain requirements.
export function commonReadinessRules(fields: readonly {id:string;label:string}[]): Protocol['rules'] {
  const rule = (id: string, label: string): Protocol['rules'][number] => ({ id, label, mandatory: true, predicate: { operator: 'equals', fact: id, value: true }, metReason: `${label}: confirmed by reviewer with evidence.`, unmetReason: `${label}: reviewer identified a gap.`, unknownReason: `${label}: not established with current confirmed evidence.` });
  const rules: Protocol['rules'] = ['scope', 'implemented', 'cause', 'evidence', 'coverage', 'exceptions'].map(id => rule(id, fields.find(field => field.id === id)!.label));
  const operationApplicability = { fact: 'operation_required', equals: true, exclusionReason: 'Reviewer recorded that operating history is not required, with supporting basis.' };
  rules.push(
  { ...rule('period', 'Required operating period is evidenced'), predicate: { operator: 'observed_days', fact: 'operation_start', endFact: 'operation_end', daysFact: 'required_days' }, applicableWhen: operationApplicability },
  { ...rule('cycles', 'Required operating cycles are evidenced'), predicate: { operator: 'at_least_fact', fact: 'observed_cycles', otherFact: 'required_cycles' }, applicableWhen: operationApplicability },
  { ...rule('retest', 'Required independent retest supports remediation'), predicate: { operator: 'equals', fact: 'retest', value: 'satisfactory' }, applicableWhen: { fact: 'retest_required', equals: true, exclusionReason: 'Reviewer recorded that an independent retest is not required, with supporting basis.' } },
  { ...rule('retest_pending', 'Required retest remains pending'), mandatory: false, predicate: { operator: 'equals', fact: 'retest', value: 'pending' }, applicableWhen: { fact: 'retest_required', equals: true, exclusionReason: 'Retest is not required for this assessment.' } },
  );
  return rules;
}

export function commonReadinessDecisions(rules: Protocol['rules']): Protocol['decisions'] {
  const prerequisiteConditions = rules.filter(item => item.mandatory && item.id !== 'retest').map(item => ({ rule: item.id, statuses: ['met', 'excluded'] as ('met' | 'excluded')[] }));
  return protocolSchema.shape.decisions.parse([
    ...['scope', 'implemented', 'cause'].map((id, priority) => ({ id: `unremediated-${id}`, priority, recommendation: 'not_closure_ready', reason: 'A confirmed scope, implementation or cause/action requirement remains unmet.', when: [{ rule: id, statuses: ['unmet'] }] })),
    { id: 'failed-retest', priority: 3, recommendation: 'not_closure_ready', reason: 'The required independent retest did not support effective remediation.', when: [{ rule: 'retest', statuses: ['unmet'] }, { rule: 'retest_pending', statuses: ['unmet'] }] },
    // Only label evidence incomplete where implementation is explicitly established.
    ...rules.filter(item => item.mandatory && !['scope', 'implemented', 'cause', 'retest'].includes(item.id)).map((item, index) => ({ id: `incomplete-${item.id}`, priority: 10 + index, recommendation: 'implemented_evidence_incomplete', reason: 'Implementation is established but evidence, coverage, exceptions or operating history is incomplete.', when: [{ rule: 'implemented', statuses: ['met'] }, { rule: item.id, statuses: ['unmet', 'unknown'] }] })),
    { id: 'pending-retest', priority: 30, recommendation: 'ready_for_retest', reason: 'All other applicable prerequisites are met; the required independent retest remains pending.', when: [...prerequisiteConditions, { rule: 'retest_pending', statuses: ['met'] }] },
    { id: 'ready', priority: 40, recommendation: 'closure_ready', reason: 'All mandatory applicable requirements are satisfied by the recorded reviewer-confirmed basis.', when: [...prerequisiteConditions, { rule: 'retest', statuses: ['met', 'excluded'] }] },
  ]);
}

export const commonReadinessTiming: Protocol['timing'] = { rule: 'period', deadlineFact: 'deadline', rationale: 'Required days and cycles are explicitly recorded by the reviewer with a finding-specific rationale. UTC calendar dates, start plus required days; no ISO-wide default.' };
