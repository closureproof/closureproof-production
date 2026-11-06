// Manual prompts, not executable closure rules. Stored with each review snapshot.
export const judgementSections = [
  { id: 'scope', title: 'Scope and evidence requirements', description: 'Establish what this finding covers and what would demonstrate effective remediation.', fields: [
    { key: 'scope_conclusion', label: 'Scope completeness judgement', placeholder: 'Are all affected systems, identities and environments accounted for? Identify omissions.' },
    { key: 'required_evidence', label: 'Evidence required for this finding', placeholder: 'List the records, approvals, before/after evidence and operating history you expect.' },
    { key: 'evidence_gaps', label: 'Missing or unreliable evidence', placeholder: 'Identify missing documents, unverifiable sources and limitations, or explain why none remain.' },
  ] },
  { id: 'cause', title: 'Root cause and corrective-action effectiveness', description: 'Assess whether the change addresses why the issue occurred and prevents recurrence.', fields: [
    { key: 'root_cause_type', label: 'Root-cause classification', options: ['Missing process', 'Unclear ownership', 'Incomplete population', 'Failed monitoring', 'Control design weakness', 'Control not operated', 'Other / not established'] },
    { key: 'cause_assessment', label: 'Root-cause adequacy judgement', placeholder: 'Is the stated cause supported by evidence? Record any competing or unresolved causes.' },
    { key: 'action_cause_assessment', label: 'Corrective action against root cause', placeholder: 'Which action addresses each cause? Explain whether the fix only treats a symptom.' },
    { key: 'recurrence_assessment', label: 'Recurrence-prevention judgement', placeholder: 'Assess ownership, monitoring, repeat operation and the likelihood of the issue returning.' },
  ] },
  { id: 'population', title: 'Population coverage and exclusions', description: 'Reconcile the complete in-scope population against the material actually inspected.', fields: [
    { key: 'population_source', label: 'Population source and reconciliation method', placeholder: 'Identify the authoritative population, date, evidence references and reconciliation approach.' },
    { key: 'uncovered_items', label: 'Uncovered items and justified exclusions', placeholder: 'Name missing identities/resources, sampling limitations and any justified exclusions. State explicitly if none remain.' },
  ] },
  { id: 'exceptions', title: 'Exceptions and residual exposure', description: 'Explain each outstanding issue and whether it prevents closure.', fields: [
    { key: 'exception_register', label: 'Exception register: reference, owner, status and evidence', placeholder: 'For each exception record its reference, description, owner, open/resolved status, compensating control and resolution evidence. State if none were identified.' },
    { key: 'exception_judgement', label: 'Exception closure impact', placeholder: 'Explain which exceptions prevent closure and justify any residual exposure being accepted.' },
  ] },
  { id: 'operation', title: 'Operating history and deadline assessment', description: 'Record your required period and cycles for this finding. These are reviewer expectations, not universal ISO thresholds.', fields: [
    { key: 'required_operating_period', label: 'Required operating period and rationale', placeholder: 'State the expected period, why it is appropriate, or justify why it is not applicable.' },
    { key: 'expected_cycles', label: 'Expected operating cycles', type: 'number' },
    { key: 'observed_cycles', label: 'Observed operating cycles', type: 'number' },
    { key: 'operating_from', label: 'Operating evidence start', type: 'date' },
    { key: 'operating_to', label: 'Operating evidence end', type: 'date' },
    { key: 'earliest_readiness', label: 'Earliest readiness date (reviewer assessed)', type: 'date' },
    { key: 'operating_judgement', label: 'Operating-history sufficiency and deadline conflicts', placeholder: 'Does the evidence show repeated effective operation? Explain shortfalls, deadline conflicts and justified changes to your expectations.' },
  ] },
  { id: 'retest', title: 'Independent retest assessment', description: 'Document a completed retest or explain what remains to be tested. File inspection alone is not a live retest.', fields: [
    { key: 'retest_status', label: 'Retest status', options: ['Not performed', 'Planned', 'Completed', 'Not applicable — justification required'] },
    { key: 'retester', label: 'Retest performed by', type: 'text' },
    { key: 'retest_date', label: 'Retest date', type: 'date' },
    { key: 'retest_scope_method', label: 'Retest scope and method', placeholder: 'Describe what was tested, the approach and its coverage, or specify the retest still required.' },
    { key: 'retest_evidence_result', label: 'Retest evidence, result and independence', placeholder: 'Reference the retest record, observations, tester relationship and limitations. Explain any not-applicable judgement.' },
  ] },
  { id: 'conclusion', title: 'Closure judgement and required follow-up', description: 'Connect your recommendation to the observations above and distinguish established facts from unresolved claims.', fields: [
    { key: 'established_facts', label: 'What the evidence establishes', placeholder: 'Summarise the remediation and effectiveness supported by identified evidence.' },
    { key: 'remaining_actions', label: 'Outstanding actions, owners and evidence requests', placeholder: 'Specify what must happen next, who should act and what evidence or retest is needed. State if no actions remain.' },
    { key: 'limitations_overrides', label: 'Limitations and reasons for any judgement override', placeholder: 'Explain uncertainty, conflicting observations and any accepted departure from the protocol. State explicitly if there are no overrides.' },
  ] },
] as const;
export type JudgementKey = typeof judgementSections[number]['fields'][number]['key'];
export type ClosureJudgement = Partial<Record<JudgementKey, string>> & { version?: string; closure_ready_acknowledged?: boolean };
