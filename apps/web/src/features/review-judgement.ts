// Manual prompts, not executable closure rules. Stored with each review snapshot.
export const judgementSections = [
  {
    id: 'scope',
    title: 'Scope and evidence requirements',
    description:
      'Establish what this finding covers and what would demonstrate effective remediation.',
    fields: [
      {
        key: 'scope_conclusion',
        label: 'Scope completeness judgement',
        placeholder:
          'Are all affected systems, identities and environments accounted for? Identify omissions.',
      },
      {
        key: 'required_evidence',
        label: 'Evidence required for this finding',
        placeholder:
          'List the records, approvals, before/after evidence and operating history you expect.',
      },
      {
        key: 'evidence_gaps',
        label: 'Missing or unreliable evidence',
        placeholder:
          'Identify missing documents, unverifiable sources and limitations, or explain why none remain.',
      },
    ],
  },
  {
    id: 'cause',
    title: 'Root cause and corrective-action effectiveness',
    description:
      'Assess whether the change addresses why the issue occurred and prevents recurrence.',
    fields: [
      {
        key: 'root_cause_type',
        label: 'Root-cause classification',
        options: [
          'Missing process',
          'Unclear ownership',
          'Incomplete population',
          'Failed monitoring',
          'Control design weakness',
          'Control not operated',
          'Other / not established',
        ],
      },
      {
        key: 'cause_assessment',
        label: 'Root-cause adequacy judgement',
        placeholder:
          'Is the stated cause supported by evidence? Record any competing or unresolved causes.',
      },
      {
        key: 'action_cause_assessment',
        label: 'Corrective action against root cause',
        placeholder:
          'Which action addresses each cause? Explain whether the fix only treats a symptom.',
      },
      {
        key: 'recurrence_assessment',
        label: 'Recurrence-prevention judgement',
        placeholder:
          'Assess ownership, monitoring, repeat operation and the likelihood of the issue returning.',
      },
    ],
  },
  {
    id: 'population',
    title: 'Population coverage and exclusions',
    description:
      'Reconcile the complete in-scope population against the material actually inspected.',
    fields: [
      {
        key: 'population_source',
        label: 'Population source and reconciliation method',
        placeholder:
          'Identify the authoritative population, date, evidence references and reconciliation approach.',
      },
      {
        key: 'uncovered_items',
        label: 'Uncovered items and justified exclusions',
        placeholder:
          'Name missing identities/resources, sampling limitations and any justified exclusions. State explicitly if none remain.',
      },
    ],
  },
  {
    id: 'exceptions',
    title: 'Exceptions and residual exposure',
    description: 'Explain each outstanding issue and whether it prevents closure.',
    fields: [
      {
        key: 'exception_register',
        label: 'Exception register: reference, owner, status and evidence',
        placeholder:
          'For each exception record its reference, description, owner, open/resolved status, compensating control and resolution evidence. State if none were identified.',
      },
      {
        key: 'exception_judgement',
        label: 'Exception closure impact',
        placeholder:
          'Explain which exceptions prevent closure and justify any residual exposure being accepted.',
      },
    ],
  },
  {
    id: 'operation',
    title: 'Operating history and deadline assessment',
    description:
      'Record your required period and cycles for this finding. These are reviewer expectations, not universal ISO thresholds.',
    fields: [
      {
        key: 'required_operating_period',
        label: 'Required operating period and rationale',
        placeholder:
          'State the expected period, why it is appropriate, or justify why it is not applicable.',
      },
      { key: 'expected_cycles', label: 'Expected operating cycles', type: 'number' },
      { key: 'observed_cycles', label: 'Observed operating cycles', type: 'number' },
      { key: 'operating_from', label: 'Operating evidence start', type: 'date' },
      { key: 'operating_to', label: 'Operating evidence end', type: 'date' },
      {
        key: 'earliest_readiness',
        label: 'Earliest readiness date (reviewer assessed)',
        type: 'date',
      },
      {
        key: 'operating_judgement',
        label: 'Operating-history sufficiency and deadline conflicts',
        placeholder:
          'Does the evidence show repeated effective operation? Explain shortfalls, deadline conflicts and justified changes to your expectations.',
      },
    ],
  },
  {
    id: 'retest',
    title: 'Independent retest assessment',
    description:
      'Document a completed retest or explain what remains to be tested. File inspection alone is not a live retest.',
    fields: [
      {
        key: 'retest_status',
        label: 'Retest status',
        options: [
          'Not performed',
          'Planned',
          'Completed',
          'Not applicable — justification required',
        ],
      },
      { key: 'retester', label: 'Retest performed by', type: 'text' },
      { key: 'retest_date', label: 'Retest date', type: 'date' },
      {
        key: 'retest_scope_method',
        label: 'Retest scope and method',
        placeholder:
          'Describe what was tested, the approach and its coverage, or specify the retest still required.',
      },
      {
        key: 'retest_evidence_result',
        label: 'Retest evidence, result and independence',
        placeholder:
          'Reference the retest record, observations, tester relationship and limitations. Explain any not-applicable judgement.',
      },
    ],
  },
  {
    id: 'conclusion',
    title: 'Closure judgement and required follow-up',
    description:
      'Connect your recommendation to the observations above and distinguish established facts from unresolved claims.',
    fields: [
      {
        key: 'established_facts',
        label: 'What the evidence establishes',
        placeholder:
          'Summarise the remediation and effectiveness supported by identified evidence.',
      },
      {
        key: 'remaining_actions',
        label: 'Outstanding actions, owners and evidence requests',
        placeholder:
          'Specify what must happen next, who should act and what evidence or retest is needed. State if no actions remain.',
      },
      {
        key: 'limitations_overrides',
        label: 'Limitations and reasons for any judgement override',
        placeholder:
          'Explain uncertainty, conflicting observations and any accepted departure from the protocol. State explicitly if there are no overrides.',
      },
    ],
  },
] as const;
export type JudgementKey = (typeof judgementSections)[number]['fields'][number]['key'];
export type ClosureJudgement = Partial<Record<JudgementKey | AdditionalJudgementKey, string>> & {
  evidence_refs?: Record<string, string[]>;
} & { retest_evidence_id?: string; version?: string; closure_ready_acknowledged?: boolean };

export const SIMPLIFIED_JUDGEMENT_VERSION = '2.0-manual';
export const JUDGEMENT_VERSION = '3.0-manual';
type DecisionKey =
  | 'scope_status'
  | 'cause_status'
  | 'population_requirement'
  | 'population_requirement_reason'
  | 'operation_requirement'
  | 'operation_requirement_reason'
  | 'retest_requirement'
  | 'retest_requirement_reason'
  | 'exceptions_status'
  | 'exceptions_status_reason'
  | 'followup_status'
  | 'limitations_status';
type AdditionalJudgementKey =
  | DecisionKey
  | 'coverage_approach'
  | 'sampling_basis'
  | 'retest_result'
  | 'retest_independence'
  | 'retest_pending_actions'
  | 'retest_not_applicable_reason';
export interface JudgementField {
  key: JudgementKey | AdditionalJudgementKey;
  label: string;
  placeholder?: string;
  type?: 'number' | 'date' | 'text';
  options?: readonly string[];
  required?: boolean;
}
export interface JudgementSection {
  id: string;
  title: string;
  description: string;
  fields: JudgementField[];
}
export const simplifiedJudgementSections: JudgementSection[] = judgementSections
  .map((section) => ({
    ...section,
    fields: (section.fields as readonly JudgementField[]).flatMap<JudgementField>((field) => {
      if (
        field.key === 'recurrence_assessment' ||
        field.key === 'exception_register' ||
        field.key === 'retest_evidence_result'
      )
        return [];
      if (field.key === 'action_cause_assessment')
        return [
          {
            ...field,
            label: 'Corrective action and recurrence prevention',
            placeholder:
              'Does the action address the supported root cause? Distinguish the immediate fix from ownership, process or monitoring changes that prevent recurrence.',
          },
        ];
      if (field.key === 'earliest_readiness')
        return [
          {
            ...field,
            label: 'Earliest readiness estimate (optional)',
            placeholder: 'Reviewer estimate, not a promised closure date.',
          },
        ];
      return [field];
    }) as JudgementField[],
  }))
  .map((section) => {
    if (section.id === 'population')
      section.fields = [
        {
          key: 'coverage_approach',
          label: 'Coverage approach',
          options: ['Full population', 'Sample', 'Not established'],
        },
        ...section.fields,
        {
          key: 'sampling_basis',
          label: 'Sampling method and limitations',
          placeholder:
            'Explain how the sample was selected, its size, coverage and limitations. A sample count is not full-population coverage.',
        },
      ];
    if (section.id === 'retest')
      section.fields.push(
        {
          key: 'retest_pending_actions',
          label: 'Outstanding retest work',
          placeholder:
            'What remains to be tested, who should arrange it and what evidence is expected?',
        },
        {
          key: 'retest_result',
          label: 'Retest result and limitations',
          placeholder:
            'Record the observed outcome, supporting evidence and any limitations. Do not infer success from a test file being present.',
        },
        {
          key: 'retest_independence',
          label: 'Tester independence and relationship',
          placeholder:
            'Describe the tester’s relationship to remediation and evidence preparation, including limitations on independence.',
        },
        {
          key: 'retest_not_applicable_reason',
          label: 'Reason retest is not applicable',
          placeholder:
            'Explain why a retest is unnecessary for this finding and identify the evidence supporting that judgement.',
        },
      );
    return section;
  });
export function judgementFields(
  section: JudgementSection,
  judgement: ClosureJudgement,
  exceptionCount = 0,
): JudgementField[] {
  if (judgement.version === JUDGEMENT_VERSION)
    return progressiveFields(section, judgement, exceptionCount);
  if (judgement.version !== SIMPLIFIED_JUDGEMENT_VERSION) return section.fields;
  return section.fields
    .filter((field) => {
      if (field.key === 'exception_judgement') return exceptionCount > 0;
      if (field.key === 'sampling_basis') return judgement.coverage_approach === 'Sample';
      if (section.id !== 'retest' || field.key === 'retest_status') return true;
      const status = judgement.retest_status;
      if (status === 'Not applicable — justification required')
        return field.key === 'retest_not_applicable_reason';
      if (status === 'Completed')
        return [
          'retester',
          'retest_date',
          'retest_scope_method',
          'retest_result',
          'retest_independence',
        ].includes(field.key);
      if (status === 'Planned' || status === 'Not performed')
        return ['retest_scope_method', 'retest_pending_actions'].includes(field.key);
      return false;
    })
    .map((field) =>
      section.id === 'retest' &&
      field.key === 'retest_scope_method' &&
      judgement.retest_status !== 'Completed'
        ? { ...field, label: 'Required retest scope and method' }
        : field,
    );
}
export function upgradeJudgement(previous?: ClosureJudgement): ClosureJudgement {
  if (!previous) return { version: JUDGEMENT_VERSION };
  if (previous.version === JUDGEMENT_VERSION) return { ...previous };
  return {
    ...previous,
    version: JUDGEMENT_VERSION,
    action_cause_assessment:
      previous.version === SIMPLIFIED_JUDGEMENT_VERSION
        ? previous.action_cause_assessment
        : [
            previous.action_cause_assessment,
            previous.recurrence_assessment
              ? `Recurrence prevention: ${previous.recurrence_assessment}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
    ...(previous.retest_status
      ? {
          retest_requirement:
            previous.retest_status === 'Not applicable — justification required'
              ? 'Not required'
              : 'Required',
          retest_requirement_reason: previous.retest_not_applicable_reason,
        }
      : {}),
  };
}
export function completedJudgement(
  judgement: ClosureJudgement,
  sections: JudgementSection[],
  exceptionCount: number,
): ClosureJudgement {
  const keys = new Set(
    sections.flatMap((section) =>
      judgementFields(section, judgement, exceptionCount).map((field) => field.key),
    ),
  );
  const values = Object.fromEntries(
    Object.entries(judgement).filter(([key]) =>
      keys.has(key as JudgementKey | AdditionalJudgementKey),
    ),
  );
  return {
    ...values,
    version: JUDGEMENT_VERSION,
    closure_ready_acknowledged: judgement.closure_ready_acknowledged,
    evidence_refs: Object.fromEntries(
      Object.entries(judgement.evidence_refs || {}).filter(([key]) =>
        sections.some((section) => section.id === key),
      ),
    ),
    ...(judgement.retest_requirement === 'Required' && judgement.retest_status === 'Completed'
      ? { retest_evidence_id: judgement.retest_evidence_id }
      : {}),
  };
}

const requirements = ['Required', 'Not required', 'Not yet established'] as const;
export const progressiveJudgementSections: JudgementSection[] = simplifiedJudgementSections.map(
  (section) => {
    const fields = section.fields.map((field) => ({ ...field }));
    const choice = (
      key: DecisionKey,
      label: string,
      options: readonly string[],
    ): JudgementField => ({ key, label, options });
    if (section.id === 'scope')
      fields.unshift(
        choice('scope_status', 'Scope and evidence assessment', [
          'Sufficient for this finding',
          'Gaps identified',
          'Not yet established',
        ]),
      );
    if (section.id === 'cause')
      fields.unshift(
        choice('cause_status', 'Root cause and corrective-action assessment', [
          'Supported',
          'Further assessment needed',
          'Not yet established',
        ]),
      );
    if (section.id === 'exceptions')
      fields.unshift(
        choice('exceptions_status', 'Are there exceptions?', [
          'None identified',
          'Exceptions identified',
          'Not yet established',
        ]),
        {
          key: 'exceptions_status_reason',
          label: 'What remains unknown about exceptions?',
          placeholder:
            'Explain what must be checked before the exception position can be established.',
        },
      );
    for (const [id, key, label] of [
      ['population', 'population_requirement', 'Is population coverage review needed?'],
      ['operation', 'operation_requirement', 'Is operating-history review needed?'],
      ['retest', 'retest_requirement', 'Is an independent retest needed?'],
    ] as const) {
      if (section.id === id)
        fields.unshift(choice(key, label, requirements), {
          key: (key + '_reason') as DecisionKey,
          label:
            id === 'retest'
              ? 'Reason for the retest decision'
              : id === 'operation'
                ? 'Reason for the operating-history decision'
                : 'Reason for the population-review decision',
          placeholder:
            'Explain why this review is not required, or what is needed to establish whether it is required.',
        });
    }
    if (section.id === 'retest')
      for (const field of fields)
        if (field.key === 'retest_status')
          field.options = ['Not performed', 'Planned', 'Completed'];
    if (section.id === 'conclusion')
      fields.unshift(
        choice('followup_status', 'Is follow-up required?', [
          'Required',
          'None required',
          'Not yet established',
        ]),
        choice('limitations_status', 'Are there limitations or judgement overrides?', [
          'Identified',
          'None identified',
          'Not yet established',
        ]),
      );
    return { ...section, fields };
  },
);
function progressiveFields(
  section: JudgementSection,
  j: ClosureJudgement,
  exceptionCount: number,
): JudgementField[] {
  const source = section.fields;
  return source
    .filter((field) => {
      const key = field.key;
      if (section.id === 'scope')
        return (
          key === 'scope_status' ||
          (!!j.scope_status &&
            (j.scope_status !== 'Sufficient for this finding' || key === 'scope_conclusion'))
        );
      if (section.id === 'cause')
        return (
          key === 'cause_status' ||
          (!!j.cause_status &&
            (j.cause_status !== 'Supported' || key === 'action_cause_assessment'))
        );
      if (section.id === 'exceptions')
        return (
          key === 'exceptions_status' ||
          (key === 'exceptions_status_reason'
            ? j.exceptions_status === 'Not yet established'
            : j.exceptions_status === 'Exceptions identified' && exceptionCount > 0)
        );
      if (['population', 'operation', 'retest'].includes(section.id)) {
        const decisionKey = (section.id + '_requirement') as DecisionKey;
        const decision = j[decisionKey];
        if (key === decisionKey) return true;
        if (key === decisionKey + '_reason') return !!decision && decision !== 'Required';
        if (decision !== 'Required') return false;
        if (section.id === 'population')
          return (
            key === 'coverage_approach' ||
            (!!j.coverage_approach &&
              (key !== 'sampling_basis' || j.coverage_approach === 'Sample'))
          );
        if (section.id === 'retest')
          return judgementFields(
            simplifiedJudgementSections.find((s) => s.id === 'retest')!,
            { ...j, version: SIMPLIFIED_JUDGEMENT_VERSION },
            exceptionCount,
          ).some((f) => f.key === key);
      }
      if (section.id === 'conclusion') {
        if (key === 'remaining_actions')
          return !!j.followup_status && j.followup_status !== 'None required';
        if (key === 'limitations_overrides')
          return !!j.limitations_status && j.limitations_status !== 'None identified';
      }
      return true;
    })
    .map((field) => {
      if (
        section.id === 'retest' &&
        field.key === 'retest_scope_method' &&
        j.retest_status !== 'Completed'
      )
        return { ...field, label: 'Required retest scope and method' };
      if (
        section.id === 'scope' &&
        j.scope_status === 'Sufficient for this finding' &&
        field.key === 'scope_conclusion'
      )
        return { ...field, label: 'Scope and evidence notes (optional)', required: false };
      if (
        section.id === 'cause' &&
        j.cause_status === 'Supported' &&
        field.key === 'action_cause_assessment'
      )
        return { ...field, label: 'Action assessment notes (optional)', required: false };
      if (
        section.id === 'population' &&
        ['Full population', 'Sample'].includes(j.coverage_approach || '') &&
        field.key === 'uncovered_items'
      )
        return { ...field, label: 'Coverage gaps and exclusions (optional)', required: false };
      return field;
    });
}
export function judgementRequirement(j: ClosureJudgement, module: string): boolean {
  return (
    j.version !== JUDGEMENT_VERSION || j[(module + '_requirement') as DecisionKey] === 'Required'
  );
}
export function validateJudgement(
  j: ClosureJudgement,
  sections: JudgementSection[],
  exceptionCount: number,
): { message: string; step: number } | null {
  for (const section of sections)
    for (const field of judgementFields(section, j, exceptionCount)) {
      const value = (j[field.key] || '').trim();
      const step = section.id === 'conclusion' ? 2 : 1;
      if (field.options && field.required !== false && !field.options.includes(value))
        return { message: `Select the reviewer judgement: ${field.label}.`, step };
      if (!field.options && !field.type && field.required !== false && value.length < 10)
        return {
          message: `Complete the reviewer judgement: ${field.label} (at least 10 characters).`,
          step,
        };
    }
  return null;
}
