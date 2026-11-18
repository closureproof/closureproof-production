import { awsIamCandidate, assessmentFields as awsIamFields } from './aws-iam';
import { assessmentFields, type EngineDraft } from './review-contracts';
import {
  commonReadinessRules,
  commonReadinessDecisions,
  commonReadinessTiming,
} from './readiness-rules';
import { protocolSchema, type Protocol } from './contracts';

export const PROTOCOL_ENGINE_VERSION = '1.0-ten-protocols';
export interface AssessmentField {
  id: string;
  label: string;
  type: 'boolean' | 'integer' | 'date' | 'retest';
  conditional?: string;
}
export interface AssessmentMethod {
  protocol: Protocol;
  fields: readonly AssessmentField[];
  evidenceGuidance: string;
}
// Finding-level closure judgements, derived from the supplied template families.
// No universal observation period, service level or automated evidence interpretation.
const commonMappings = {
  'iso-POL-05': ['cause'],
  'iso-ODOC-33': ['exceptions', 'cause'],
  'iso-INF-02': ['scope', 'coverage'],
  'iso-INF-03': ['scope', 'coverage'],
};
const specs = [
  {
    code: 'access',
    title: 'Periodic access reviews',
    scope: 'Scope and approved entitlement baseline are established',
    coverage: 'The access-review population is reconciled to authoritative identity sources',
    evidence:
      'Complete identity inventory, approved entitlements, dated access decisions, approvals and resulting removals or changes.',
    domains: [
      ['access_decisions', 'Every in-scope identity has a documented access decision'],
      ['access_changes', 'Required access changes are completed and reconciled'],
    ],
    mappings: {
      'iso-ACC-00': ['coverage', 'access_decisions'],
      'iso-ACC-02': ['coverage'],
      'iso-ACC-06': ['coverage'],
      'iso-ACC-10': ['access_decisions', 'access_changes'],
      'iso-PEO-02': ['coverage'],
      'iso-PEO-07': ['coverage'],
      'iso-POL-03': ['scope'],
      'iso-POL-11': ['cause'],
      'iso-ODOC-04': ['access_decisions'],
      'iso-RSK-05': ['exceptions', 'access_changes'],
      'iso-ACC-05': ['access_changes'],
      'iso-ACC-09': ['access_changes'],
      'iso-PEO-08': ['access_changes'],
    },
  },
  {
    code: 'leavers',
    title: 'Joiner, mover and leaver access',
    scope:
      'Relevant employment events, systems and approved access-change deadlines are established',
    coverage: 'Employment events and associated system accounts are reconciled',
    evidence:
      'Dated joiner/mover/leaver events, linked accounts, approvals, revocation/change timestamps and exceptions against the organisation’s policy.',
    domains: [
      [
        'event_actions',
        'Required account and access changes are completed for each in-scope event',
      ],
      [
        'event_timeliness',
        'Access changes meet the applicable approved deadlines or have documented acceptable treatment',
      ],
    ],
    mappings: {
      'iso-PEO-02': ['coverage'],
      'iso-PEO-07': ['coverage'],
      'iso-PEO-08': ['event_actions', 'event_timeliness'],
      'iso-ACC-00': ['coverage'],
      'iso-ACC-05': ['event_actions', 'event_timeliness'],
      'iso-ACC-09': ['event_actions', 'event_timeliness'],
      'iso-ODOC-20': ['event_actions'],
      'iso-POL-03': ['scope'],
      'iso-POL-19': ['scope'],
      'iso-ODOC-10': ['scope'],
      'iso-ODOC-29': ['scope'],
      'iso-ACC-02': ['coverage'],
      'iso-ACC-06': ['coverage'],
      'iso-ACC-10': ['event_actions'],
      'iso-ODOC-04': ['event_actions'],
    },
  },
  {
    code: 'mfa',
    title: 'MFA enforcement',
    scope: 'Applicable identities, authentication paths and MFA requirements are established',
    coverage: 'All affected identities and authentication paths are accounted for',
    evidence:
      'Enforcement configuration, affected identity inventory, authentication test records and documented bypass/recovery exceptions.',
    domains: [
      [
        'mfa_enforcement',
        'Required authentication paths enforce MFA rather than merely enrolling users',
      ],
      [
        'mfa_bypass',
        'Bypass, recovery and exception paths have been inspected and acceptably controlled',
      ],
    ],
    mappings: {
      'iso-ACC-03': ['mfa_enforcement'],
      'iso-ACC-04': ['mfa_enforcement'],
      'iso-ACC-07': ['mfa_enforcement'],
      'iso-ACC-00': ['coverage'],
      'iso-ACC-01': ['mfa_bypass'],
      'iso-POL-03': ['scope', 'mfa_bypass'],
      'iso-DEV-04': ['scope'],
      'iso-ACC-08': ['mfa_bypass'],
      'iso-DOC-08': ['mfa_enforcement'],
    },
  },
  {
    code: 'patch',
    title: 'Vulnerability and patch remediation',
    scope: 'Affected vulnerabilities, assets and approved remediation requirements are established',
    coverage: 'Affected assets and vulnerability instances are reconciled',
    evidence:
      'Original vulnerability references, affected asset/version inventory, change records and post-remediation scan/test results with limitations.',
    domains: [
      [
        'vulnerability_fixed',
        'The specific vulnerability is remediated or has documented acceptable treatment',
      ],
      [
        'vulnerability_verified',
        'Post-remediation verification covers the affected assets and vulnerability instances',
      ],
    ],
    mappings: {
      'iso-VUL-01': ['coverage'],
      'iso-VUL-02': ['cause'],
      'iso-VUL-03': ['coverage', 'vulnerability_fixed'],
      'iso-VUL-04': ['coverage', 'vulnerability_verified'],
      'iso-VUL-05': ['scope'],
      'iso-VUL-06': ['vulnerability_fixed'],
      'iso-VUL-07': ['vulnerability_verified'],
      'iso-VUL-08': ['coverage'],
      'iso-DEV-03': ['vulnerability_fixed'],
      'iso-DEV-05': ['vulnerability_fixed'],
      'iso-DOC-17': ['vulnerability_verified'],
      'iso-DOC-18': ['vulnerability_fixed', 'vulnerability_verified'],
      'iso-RSK-08': ['cause', 'vulnerability_fixed'],
      'iso-POL-22': ['scope'],
    },
  },
  {
    code: 'backup',
    title: 'Backup restoration testing',
    scope: 'In-scope workloads and approved recovery objectives are established',
    coverage: 'Restoration evidence covers the required workloads and recovery scenarios',
    evidence:
      'Workload inventory, approved recovery objectives, recovery-point selection, restoration logs, integrity checks and observed recovery measurements.',
    domains: [
      ['restore_integrity', 'Restoration execution and restored-data integrity are evidenced'],
      [
        'recovery_objectives',
        'Observed restoration results meet the approved recovery objectives or have documented acceptable treatment',
      ],
    ],
    mappings: {
      'iso-DOC-01': ['coverage'],
      'iso-DOC-14': ['restore_integrity', 'recovery_objectives'],
      'iso-DOC-10': ['coverage'],
      'iso-DOC-11': ['recovery_objectives'],
      'iso-POL-17': ['scope', 'recovery_objectives'],
      'iso-POL-22': ['scope'],
      'iso-RSK-06': ['coverage', 'recovery_objectives'],
      'iso-ODOC-16': ['restore_integrity', 'recovery_objectives'],
    },
  },
  {
    code: 'supplier',
    title: 'Supplier security review',
    scope: 'Supplier services, risk treatment and required security obligations are established',
    coverage: 'Relevant suppliers, services and data-processing relationships are reconciled',
    evidence:
      'Supplier/service inventory, risk assessment, completed security review, applicable agreements and outstanding-condition dispositions.',
    domains: [
      [
        'supplier_assessment',
        'The relevant supplier/service security assessment is complete and current against the agreed requirements',
      ],
      [
        'supplier_conditions',
        'Outstanding contractual/security conditions have a supported acceptable disposition',
      ],
    ],
    mappings: {
      'iso-VEN-01': ['coverage'],
      'iso-VEN-02': ['scope'],
      'iso-VEN-03': ['cause'],
      'iso-VEN-04': ['supplier_assessment'],
      'iso-VEN-05': ['supplier_conditions'],
      'iso-VEN-06': ['supplier_assessment'],
      'iso-VEN-07': ['supplier_conditions'],
      'iso-POL-13': ['scope'],
      'iso-RDOC-01': ['supplier_conditions'],
      'iso-RDOC-04': ['supplier_conditions'],
      'iso-RDOC-05': ['supplier_conditions'],
      'iso-RDOC-06': ['supplier_conditions'],
      'iso-RDOC-07': ['supplier_conditions'],
      'iso-RDOC-08': ['supplier_assessment'],
      'iso-ODOC-29': ['supplier_conditions'],
    },
  },
  {
    code: 'logging',
    title: 'Security logging and monitoring',
    scope: 'Required sources, events, retention and monitoring responsibilities are established',
    coverage: 'Required log/event sources and affected environments are reconciled',
    evidence:
      'Source inventory, collection/retention configuration, attributable sample events, alert delivery tests and handling/review records.',
    domains: [
      [
        'log_collection',
        'Required events are collected with attributable timestamps and appropriate integrity/retention evidence',
      ],
      [
        'monitoring_response',
        'Relevant monitoring or alerts reach an accountable responder and handling is evidenced',
      ],
    ],
    mappings: {
      'iso-INF-08': ['log_collection'],
      'iso-INF-09': ['log_collection'],
      'iso-INF-10': ['monitoring_response'],
      'iso-INF-11': ['monitoring_response'],
      'iso-DOC-12': ['log_collection'],
      'iso-DOC-19': ['coverage', 'monitoring_response'],
      'iso-DOC-24': ['monitoring_response'],
      'iso-POL-22': ['scope'],
      'iso-POL-18': ['monitoring_response'],
      'iso-RSK-10': ['log_collection', 'monitoring_response'],
      'iso-INF-01': ['coverage'],
    },
  },
  {
    code: 'changes',
    title: 'Change management and approval',
    scope: 'Applicable change population and approved change requirements are established',
    coverage: 'Affected releases, repositories and relevant changes are reconciled',
    evidence:
      'Change/release records, approvals and reviewer identities, testing results, release traceability and emergency-change dispositions.',
    domains: [
      [
        'change_authorised',
        'Relevant changes have evidenced authorisation and required separation of responsibilities',
      ],
      [
        'change_verified',
        'Testing, acceptance and release/rollback traceability support the corrective changes',
      ],
    ],
    mappings: {
      'iso-COD-01': ['coverage'],
      'iso-COD-02': ['scope'],
      'iso-COD-03': ['change_authorised'],
      'iso-COD-04': ['change_authorised'],
      'iso-COD-05': ['change_authorised'],
      'iso-DOC-02': ['change_verified'],
      'iso-DOC-05': ['change_verified'],
      'iso-DOC-13': ['change_verified'],
      'iso-DOC-15': ['scope'],
      'iso-DOC-22': ['change_verified'],
      'iso-DOC-23': ['change_verified'],
      'iso-POL-16': ['scope'],
      'iso-ODOC-11': ['scope'],
      'iso-ODOC-28': ['change_authorised', 'change_verified'],
      'iso-RSK-02': ['change_verified'],
    },
  },
  {
    code: 'incidents',
    title: 'Incident response and follow-up',
    scope:
      'The relevant incident/exercise, response requirements and affected systems are established',
    coverage: 'The incident/exercise scope, response actions and affected services are reconciled',
    evidence:
      'Incident/exercise timeline, response and communication records, cause analysis, lessons and completed corrective follow-up with verification.',
    domains: [
      [
        'incident_response',
        'Required response and communication actions are evidenced for the incident or exercise',
      ],
      [
        'incident_followup',
        'Lessons and root-cause corrective actions have been implemented and verified',
      ],
    ],
    mappings: {
      'iso-POL-18': ['scope', 'incident_response'],
      'iso-POL-27': ['incident_response'],
      'iso-ODOC-16': ['incident_response', 'incident_followup'],
      'iso-ODOC-32': ['cause', 'incident_followup'],
      'iso-DOC-19': ['coverage'],
      'iso-DOC-24': ['incident_response'],
      'iso-INF-10': ['incident_response'],
      'iso-INF-11': ['incident_response'],
      'iso-RSK-10': ['incident_followup'],
      'iso-POL-17': ['scope', 'incident_response'],
    },
  },
] as const;

function buildMethod(spec: (typeof specs)[number]): AssessmentMethod {
  const fields: AssessmentField[] = [
    ...assessmentFields.map((field) => ({
      ...field,
      label:
        field.id === 'scope' ? spec.scope : field.id === 'coverage' ? spec.coverage : field.label,
    })),
    ...spec.domains.map(([id, label]) => ({ id, label, type: 'boolean' as const })),
  ];
  const domainRules: Protocol['rules'] = spec.domains.map(([id, label]) => ({
    id,
    label,
    mandatory: true,
    predicate: { operator: 'equals', fact: id, value: true },
    metReason: label + ': supported by the reviewer-confirmed evidence.',
    unmetReason: label + ': a material requirement remains unmet.',
    unknownReason: label + ': not established with current confirmed evidence.',
  }));
  const baseRules = commonReadinessRules(fields);
  const rules = baseRules.map((rule) => {
    const field = fields.find((field) => field.id === rule.id);
    return field
      ? {
          ...rule,
          label: field.label,
          metReason: field.label + ': confirmed by reviewer with evidence.',
          unmetReason: field.label + ': reviewer identified a gap.',
          unknownReason: field.label + ': not established with current confirmed evidence.',
        }
      : structuredClone(rule);
  });
  rules.push(...domainRules);
  const decisions = commonReadinessDecisions(baseRules).map((decision) => ({
    ...decision,
    when: [
      ...decision.when,
      ...(['pending-retest', 'ready'].includes(decision.id)
        ? domainRules.map((rule) => ({ rule: rule.id, statuses: ['met'] as 'met'[] }))
        : []),
    ],
  }));
  domainRules.forEach((rule, index) => {
    decisions.push({
      id: 'domain-unmet-' + rule.id,
      priority: 4 + index,
      recommendation: 'not_closure_ready',
      reason: rule.unmetReason,
      when: [{ rule: rule.id, statuses: ['unmet'] }],
    });
    decisions.push({
      id: 'domain-unknown-' + rule.id,
      priority: 20 + index,
      recommendation: 'implemented_evidence_incomplete',
      reason: rule.unknownReason,
      when: [
        { rule: 'implemented', statuses: ['met'] },
        { rule: rule.id, statuses: ['unknown'] },
      ],
    });
  });
  const protocol = protocolSchema.parse({
    author: 'ClosureProof product method',
    hitPolicy: 'explicit_priority',
    timing: commonReadinessTiming,
    code: spec.code,
    title: spec.title,
    version: '0.1.0-checklist-candidate',
    rationale:
      'Category-specific candidate based on the supplied ISO checklist and explicit closure judgements. ' +
      spec.evidence +
      ' No universal timing threshold, audit pass/fail or live-system verification is implied. Independent validation remains pending.',
    facts: fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type === 'retest' ? 'text' : field.type,
    })),
    rules,
    decisions,
    checklistPolicy: {
      version: '1.0-iso27001-' + spec.code,
      mappings: { ...commonMappings, ...spec.mappings },
    },
  });
  return { protocol, fields, evidenceGuidance: spec.evidence };
}
const expandedAwsIam = protocolSchema.parse({
  ...awsIamCandidate,
  version: '0.3.0-checklist-candidate',
  checklistPolicy: {
    version: '1.1-iso27001-aws-iam',
    mappings: {
      ...awsIamCandidate.checklistPolicy!.mappings,
      'iso-ACC-00': ['scope', 'coverage'],
      'iso-ACC-06': ['coverage'],
      'iso-INF-04': ['scope'],
      'iso-PEO-07': ['coverage'],
    },
  },
});
export const assessmentMethods: readonly AssessmentMethod[] = [
  {
    protocol: expandedAwsIam,
    fields: awsIamFields,
    evidenceGuidance:
      'Approved entitlements, identity/role inventory, access changes, attributable activity and relevant verification records.',
  },
  ...specs.map(buildMethod),
];
export function assessmentMethod(code: string): AssessmentMethod | undefined {
  return assessmentMethods.find((method) => method.protocol.code === code);
}
export function newProtocolDraft(code: string, previous?: EngineDraft): EngineDraft {
  const method = assessmentMethod(code);
  if (!method) throw Error('No rules-supported protocol for this finding category.');
  if (previous?.protocolCode && previous.protocolCode !== code)
    throw Error('Saved facts belong to another protocol.');
  return {
    version: method.protocol.version as EngineDraft['version'],
    protocolCode: code,
    entries: previous?.entries || {},
    ...(previous?.dateDecisions ? { dateDecisions: previous.dateDecisions } : {}),
  };
}
