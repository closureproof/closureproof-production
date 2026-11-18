import { checklistAnswerSchema, type ChecklistMappingSnapshot } from './checklist-mapping';
import { z } from 'zod';

export const ENGINE_VERSION = '1.1.0';
export const recommendations = [
  'not_closure_ready',
  'implemented_evidence_incomplete',
  'ready_for_retest',
  'closure_ready',
] as const;
const id = z.string().trim().min(1).max(120);
const text = z.string().trim().min(1).max(4000);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Use a real calendar date (YYYY-MM-DD).');
const scalar = z.union([z.boolean(), z.number().finite(), z.string().min(1).max(4000)]);
const sourceSchema = z
  .object({
    kind: z.enum(['evidence', 'finding']).optional(),
    evidenceId: id,
    version: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    locator: text,
  })
  .strict();
export const factSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unknown'), reason: text }).strict(),
  z
    .object({
      state: z.literal('confirmed'),
      value: scalar,
      confirmedBy: text,
      confirmedOn: dateSchema,
      basis: text,
      sources: z.array(sourceSchema).min(1).max(100),
    })
    .strict(),
]);
const factDefinition = z
  .object({
    id,
    label: text,
    type: z.enum(['boolean', 'number', 'integer', 'text', 'date']),
    unit: id.optional(),
  })
  .strict();
const comparison = z.discriminatedUnion('operator', [
  z.object({ operator: z.literal('equals'), fact: id, value: scalar }).strict(),
  z.object({ operator: z.literal('at_least'), fact: id, value: z.number().finite() }).strict(),
  z.object({ operator: z.literal('at_most'), fact: id, value: z.number().finite() }).strict(),
  z.object({ operator: z.literal('at_least_fact'), fact: id, otherFact: id }).strict(),
  z.object({ operator: z.literal('observed_days'), fact: id, endFact: id, daysFact: id }).strict(),
  z
    .object({
      operator: z.literal('elapsed_days'),
      fact: id,
      days: z.number().int().min(0).max(36500),
      convention: z.literal('utc_date_plus_days'),
    })
    .strict(),
]);
export const protocolSchema = z
  .object({
    code: id,
    title: text,
    version: id,
    author: text,
    rationale: text,
    hitPolicy: z.enum(['unique', 'explicit_priority']).default('unique'),
    checklistPolicy: z
      .object({ version: id, mappings: z.record(z.string(), z.array(id).min(1)) })
      .strict()
      .optional(),
    facts: z.array(factDefinition).min(1).max(100),
    rules: z
      .array(
        z
          .object({
            id,
            label: text,
            mandatory: z.boolean(),
            predicate: comparison,
            applicableWhen: z
              .object({ fact: id, equals: scalar, exclusionReason: text })
              .strict()
              .optional(),
            metReason: text,
            unmetReason: text,
            unknownReason: text,
          })
          .strict(),
      )
      .min(1)
      .max(100),
    decisions: z
      .array(
        z
          .object({
            id,
            priority: z.number().int().nonnegative(),
            recommendation: z.enum(recommendations),
            reason: text,
            when: z
              .array(
                z
                  .object({
                    rule: id,
                    statuses: z.array(z.enum(['met', 'unmet', 'unknown', 'excluded'])).min(1),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    timing: z.object({ rule: id, deadlineFact: id, rationale: text }).strict().optional(),
  })
  .strict()
  .superRefine((protocol, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (values: (string | number)[], label: string) => {
      if (new Set(values).size !== values.length) issue(`Duplicate ${label}.`);
    };
    unique(
      protocol.facts.map((fact) => fact.id),
      'fact ID',
    );
    unique(
      protocol.rules.map((rule) => rule.id),
      'rule ID',
    );
    unique(
      protocol.decisions.map((decision) => decision.id),
      'decision ID',
    );
    unique(
      protocol.decisions.map((decision) => decision.priority),
      'decision priority',
    );
    const facts = new Map(protocol.facts.map((fact) => [fact.id, fact]));
    const rules = new Map(protocol.rules.map((rule) => [rule.id, rule]));
    const checkValue = (key: string, value: unknown) => {
      const fact = facts.get(key);
      if (!fact) {
        issue(`Unknown fact ${key}.`);
        return;
      }
      if (!matchesType(fact.type, value)) issue(`Incorrect value type for ${key}.`);
    };
    for (const rule of protocol.rules) {
      const predicate = rule.predicate;
      const fact = facts.get(predicate.fact);
      if (!fact) issue(`Unknown fact ${predicate.fact}.`);
      if (predicate.operator === 'equals') checkValue(predicate.fact, predicate.value);
      else if (predicate.operator === 'observed_days') {
        if (
          fact?.type !== 'date' ||
          facts.get(predicate.endFact)?.type !== 'date' ||
          facts.get(predicate.daysFact)?.type !== 'integer'
        )
          issue(`${rule.id} requires start/end dates and integer days.`);
      } else if (predicate.operator === 'elapsed_days') {
        if (fact?.type !== 'date') issue(`${rule.id} requires a date fact.`);
      } else {
        if (fact && !['number', 'integer'].includes(fact.type))
          issue(`${rule.id} requires a numeric fact.`);
        if (
          predicate.operator === 'at_least_fact' &&
          !['number', 'integer'].includes(facts.get(predicate.otherFact)?.type || '')
        )
          issue(`${rule.id} requires a numeric comparison fact.`);
      }
      if (rule.applicableWhen) checkValue(rule.applicableWhen.fact, rule.applicableWhen.equals);
    }
    for (const decision of protocol.decisions) {
      unique(
        decision.when.map((condition) => condition.rule),
        `condition in ${decision.id}`,
      );
      for (const condition of decision.when)
        if (!rules.has(condition.rule)) issue(`Unknown rule ${condition.rule}.`);
    }
    if (protocol.timing) {
      if (
        !['elapsed_days', 'observed_days'].includes(
          rules.get(protocol.timing.rule)?.predicate.operator || '',
        )
      )
        issue('Timing must reference an elapsed-days rule.');
      if (facts.get(protocol.timing.deadlineFact)?.type !== 'date')
        issue('Deadline must be a date fact.');
    }
  });

export function matchesType(type: string, value: unknown): boolean {
  if (type === 'date') return dateSchema.safeParse(value).success;
  if (type === 'integer')
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return (
    typeof value === (type === 'text' ? 'string' : type) &&
    (type !== 'text' || String(value).trim().length > 0)
  );
}
export const assessmentInputSchema = z
  .object({
    findingId: id,
    findingRevision: z.number().int().positive(),
    scopeRevision: z.number().int().positive(),
    evaluationDate: dateSchema,
    facts: z.record(z.string(), factSchema),
    checklist: z
      .object({
        definitions: z.array(z.object({ id, label: text }).strict()).max(200),
        answers: z.array(checklistAnswerSchema).max(200),
      })
      .strict()
      .optional(),
    findingContext: z
      .object({
        id,
        revision: z.number().int().positive(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        deadline: dateSchema,
      })
      .strict()
      .optional(),
    evidence: z
      .array(
        z
          .object({
            id,
            version: z.number().int().positive(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict();
export type Protocol = z.infer<typeof protocolSchema>;
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
export type Recommendation = (typeof recommendations)[number];
export type RuleStatus = 'met' | 'unmet' | 'unknown' | 'excluded';
export interface RuleResult {
  id: string;
  status: RuleStatus;
  mandatory: boolean;
  reason: string;
  factIds: string[];
  missingFacts: string[];
  evidenceIds: string[];
  earliestDate?: string;
}
export interface Evaluation {
  engineVersion: string;
  protocol: { code: string; version: string };
  mode: 'draft';
  findingId: string;
  findingRevision: number;
  scopeRevision: number;
  evaluationDate: string;
  recommendation: Recommendation | null;
  decisionId: string | null;
  matchedDecisionIds: string[];
  decisionReason: string;
  rules: RuleResult[];
  missingFacts: string[];
  checklistMapping?: ChecklistMappingSnapshot;
  warnings: {
    code: 'deadline_conflict' | 'timing_unavailable';
    message: string;
    earliestDate?: string;
    deadline?: string;
  }[];
}
