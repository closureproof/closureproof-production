import { mapAwsIamChecklist, applyChecklistMapping } from './checklist-mapping';
export * from './contracts';
import { ENGINE_VERSION, assessmentInputSchema, matchesType, protocolSchema, type AssessmentInput, type Evaluation, type Protocol, type RuleResult } from './contracts';

const dayMs = 86_400_000;
const addDays = (date: string, days: number) => {
  const result = new Date(Date.parse(`${date}T00:00:00Z`) + days * dayMs).toISOString();
  return /^\d{4}-/.test(result) ? result.slice(0, 10) : undefined;
};

/** Pure evaluation: explicit date, no AI, IO, clock, inferred facts, or live-workflow mutation. */
export function evaluateDraftProtocol(definition: Protocol, assessment: AssessmentInput): Evaluation {
  const protocol = protocolSchema.parse(definition);
  const input = assessmentInputSchema.parse(assessment);
  const definitions = new Map(protocol.facts.map(fact => [fact.id, fact]));
  const evidence = new Map(input.evidence.map(item => [item.id, item]));
  if (evidence.size !== input.evidence.length) throw new Error('Evidence IDs must be unique.');
  for (const key of Object.keys(input.facts)) if (!definitions.has(key)) throw new Error(`Unrecognised fact: ${key}.`);
  const read = (key: string) => {
    const fact = input.facts[key];
    if (!fact || fact.state === 'unknown') return undefined;
    if (!matchesType(definitions.get(key)!.type, fact.value)) return undefined;
    if (fact.confirmedOn > input.evaluationDate) return undefined;
    if (!fact.sources.every(source => {
      const current = evidence.get(source.evidenceId);
      return current?.version === source.version && current.sha256 === source.sha256;
    })) return undefined;
    return fact.value;
  };
  const rules: RuleResult[] = protocol.rules.map(rule => {
    const predicate = rule.predicate;
    const applicable = rule.applicableWhen;
    const factIds = [...new Set([predicate.fact, ...(predicate.operator === 'at_least_fact' ? [predicate.otherFact] : predicate.operator === 'observed_days' ? [predicate.endFact, predicate.daysFact] : []), ...(applicable ? [applicable.fact] : [])])];
    const evidenceIds = [...new Set(factIds.flatMap(key => {
      const fact = input.facts[key];
      return fact?.state === 'confirmed' ? fact.sources.map(source => source.evidenceId) : [];
    }))].sort();
    const base = { id: rule.id, mandatory: rule.mandatory, factIds, evidenceIds };
    if (applicable) {
      const value = read(applicable.fact);
      if (value === undefined) return { ...base, status: 'unknown', reason: rule.unknownReason, missingFacts: [applicable.fact] };
      if (value !== applicable.equals) return { ...base, status: 'excluded', reason: applicable.exclusionReason, missingFacts: [] };
    }
    const required = [predicate.fact, ...(predicate.operator === 'at_least_fact' ? [predicate.otherFact] : predicate.operator === 'observed_days' ? [predicate.endFact, predicate.daysFact] : [])];
    const missingFacts = required.filter(key => read(key) === undefined);
    if (missingFacts.length) {
      const start = read(predicate.fact);
      const days = predicate.operator === 'observed_days' ? read(predicate.daysFact) : undefined;
      const earliestDate = predicate.operator === 'observed_days' && typeof start === 'string' && typeof days === 'number' && days <= 36500 ? addDays(start, days) : undefined;
      return { ...base, status: 'unknown', reason: rule.unknownReason, missingFacts, ...(earliestDate ? { earliestDate } : {}) };
    }
    const value = read(predicate.fact)!;
    let met: boolean;
    let earliestDate: string | undefined;
    switch (predicate.operator) {
      case 'equals': met = value === predicate.value; break;
      case 'at_least': met = (value as number) >= predicate.value; break;
      case 'at_most': met = (value as number) <= predicate.value; break;
      case 'at_least_fact': met = (value as number) >= (read(predicate.otherFact) as number); break;
      case 'observed_days': {
        const end = read(predicate.endFact) as string;
        const days = read(predicate.daysFact) as number;
        if (days > 36500 || end > input.evaluationDate || end < String(value)) return { ...base, status: 'unknown', reason: 'Operating dates or required days are invalid for this assessment date.', missingFacts: [predicate.fact, predicate.endFact, predicate.daysFact] };
        earliestDate = addDays(value as string, days);
        if (!earliestDate) return { ...base, status: 'unknown', reason: 'The operating period exceeds the supported calendar range.', missingFacts: [predicate.fact, predicate.daysFact] };
        met = end >= earliestDate;
        break;
      }
      case 'elapsed_days':
        earliestDate = addDays(value as string, predicate.days);
        if (!earliestDate) return { ...base, status: 'unknown', reason: 'The operating period exceeds the supported calendar range.', missingFacts: [predicate.fact] };
        met = input.evaluationDate >= earliestDate;
        break;
    }
    return { ...base, status: met ? 'met' : 'unmet', reason: met ? rule.metReason : rule.unmetReason, missingFacts: [], ...(earliestDate ? { earliestDate } : {}) };
  });
  const byId = new Map(rules.map(rule => [rule.id, rule]));
  const matches = [...protocol.decisions].sort((a, b) => a.priority - b.priority).filter(item => item.when.every(condition => condition.statuses.includes(byId.get(condition.rule)!.status)));
  const ambiguous = protocol.hitPolicy === 'unique' && matches.length > 1;
  const decision = ambiguous ? undefined : matches[0];
  // A permissive decision table cannot bypass mandatory blockers for closure readiness.
  const unsafeReady = decision?.recommendation === 'closure_ready' && rules.some(rule => rule.mandatory && !['met', 'excluded'].includes(rule.status));
  const warnings: Evaluation['warnings'] = [];
  if (protocol.timing) {
    const rule = byId.get(protocol.timing.rule)!;
    if (rule.status !== 'excluded') {
      const deadline = read(protocol.timing.deadlineFact);
      if (!rule.earliestDate || deadline === undefined) warnings.push({ code: 'timing_unavailable', message: 'The timing warning needs a confirmed operating start and deadline with current evidence references.' });
      else if (rule.earliestDate > String(deadline)) warnings.push({ code: 'deadline_conflict', message: 'The earliest operating-period eligibility date is after the finding deadline. This date alone does not establish closure readiness.', earliestDate: rule.earliestDate, deadline: String(deadline) });
    }
  }
  const evaluation: Evaluation = {
    engineVersion: ENGINE_VERSION, protocol: { code: protocol.code, version: protocol.version }, mode: 'draft',
    findingId: input.findingId, findingRevision: input.findingRevision, scopeRevision: input.scopeRevision, evaluationDate: input.evaluationDate,
    recommendation: unsafeReady ? null : decision?.recommendation || null, decisionId: unsafeReady ? null : decision?.id || null, matchedDecisionIds: matches.map(item => item.id),
    decisionReason: ambiguous ? 'Multiple outcome cases match a unique decision table. Resolve the protocol conflict before issuing a recommendation.' : unsafeReady ? 'The decision table attempts closure readiness with unmet or unknown mandatory requirements.' : decision?.reason || 'No agreed decision-table case matches these facts.',
    rules, missingFacts: [...new Set(rules.flatMap(rule => rule.missingFacts))].sort(), warnings,
  };
  if (protocol.checklistPolicy) {
    const mapping=mapAwsIamChecklist(input.checklist?.definitions||[],input.checklist?.answers||[],input.evidence.map(item=>item.id),protocol.checklistPolicy.mappings,protocol.checklistPolicy.version);
    return {...applyChecklistMapping(evaluation,mapping),checklistMapping:mapping};
  }
  return evaluation;
}
