import { assessmentMethod } from '@closureproof/assessment-engine/protocol-catalogue';
import type { AIReviewOutput, ProposalFact } from '../ai-review-contract';
import type { ReviewContext } from './ai-review-preparation';
import { activeSections } from '../../features/control-scope';
import { JUDGEMENT_VERSION } from '../../features/review-judgement';
// Processing budgets are per request, not a restriction on the review's sources.
export function reviewBatches(context: ReviewContext): ReviewContext[] {
  const chunks: ProposalFact[][] = [];
  let chunk: ProposalFact[] = [];
  let bytes = 0;
  for (const fact of context.facts) {
    const size = new TextEncoder().encode(JSON.stringify(fact)).length;
    if (chunk.length && (bytes + size > 70000 || chunk.length >= 128)) {
      chunks.push(chunk);
      chunk = [];
      bytes = 0;
    }
    chunk.push(fact);
    bytes += size;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks.map((facts, index) => ({
    ...context,
    facts,
    documentLimitations: [
      ...(context.documentLimitations || []),
      ...(chunks.length > 1
        ? [
            `Evidence batch ${index + 1} of ${chunks.length}. Other batches are assessed separately and reconciled before the review is presented. Do not infer absent evidence from this batch.`,
          ]
        : []),
    ],
  }));
}
const unique = (values: string[]) => [...new Set(values)];
const note = (values: string[], max: number) =>
  unique(values.filter(Boolean)).join('\n').slice(0, max);
export function mergeReviewBatches(
  outputs: AIReviewOutput[],
  context: ReviewContext,
): AIReviewOutput {
  if (outputs.length === 1) return outputs[0];
  const conflicts = unique(outputs.flatMap((output) => output.conflicts));
  const fields: Map<string, { options?: readonly string[]; type?: string }> = new Map(
    activeSections(context.finding.protocol, { version: JUDGEMENT_VERSION })
      .flatMap((section) => section.fields)
      .map((field) => [field.key, field]),
  );
  function group<T>(items: T[], key: (item: T) => string) {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const id = key(item);
      groups.set(id, [...(groups.get(id) || []), item]);
    }
    return [...groups.entries()];
  }
  const checklist = group(
    outputs.flatMap((output) => output.checklist),
    (item) => item.check_id,
  ).map(([check_id, all]) => {
    const supported = all.filter(
      (item) => item.source_refs.length && item.implementation_status !== 'not_assessed',
    );
    const relevant = supported.length ? supported : all;
    const states = unique(
      supported.map((item) => item.applicability + ':' + item.implementation_status),
    );
    const first = relevant[0];
    if (states.length > 1)
      conflicts.push(
        check_id + ': evidence batches disagree about applicability or implementation.',
      );
    return {
      ...first,
      check_id,
      ...(states.length > 1
        ? { applicability: 'under_review' as const, implementation_status: 'not_assessed' as const }
        : {}),
      rationale: note(
        relevant.map((item) => item.rationale),
        1500,
      ),
      source_refs: unique(all.flatMap((item) => item.source_refs)),
    };
  });
  const engine = group(
    outputs.flatMap((output) => output.engine),
    (item) => item.field_id,
  ).map(([field_id, all]) => {
    const values = unique(all.flatMap((item) => (item.value === null ? [] : [item.value])));
    if (
      values.length > 1 &&
      assessmentMethod(context.finding.protocol.code)?.fields.find((field) => field.id === field_id)
        ?.type !== 'date'
    )
      conflicts.push(field_id + ': evidence batches propose different assessment values.');
    return {
      field_id,
      value: values.length === 1 ? values[0] : null,
      rationale: note(
        all.map((item) => item.rationale),
        1500,
      ),
      source_refs: unique(all.flatMap((item) => item.source_refs)),
    };
  });
  const judgements = group(
    outputs.flatMap((output) => output.judgements),
    (item) => item.field,
  ).map(([field, all]) => {
    const definition = fields.get(field);
    const values = unique(
      all.flatMap((item) =>
        item.value === null ||
        ['Not yet established', 'Not established', 'Other / not established'].includes(item.value)
          ? []
          : [item.value],
      ),
    );
    const constrained = !!definition?.options || !!definition?.type;
    if (constrained && values.length > 1 && definition?.type !== 'date')
      conflicts.push(field + ': evidence batches propose different reviewer judgements.');
    return {
      field,
      value: constrained
        ? values.length === 1
          ? values[0]
          : null
        : values.length
          ? note(values, 2000)
          : null,
      source_refs: unique(all.flatMap((item) => item.source_refs)),
    };
  });
  const population = {
    expected: null as number | null,
    reviewed: null as number | null,
    source_refs: unique(outputs.flatMap((output) => output.population.source_refs)),
  };
  for (const key of ['expected', 'reviewed'] as const) {
    const values = [
      ...new Set(
        outputs.flatMap((output) =>
          output.population[key] === null ? [] : [output.population[key]!],
        ),
      ),
    ];
    if (values.length > 1)
      conflicts.push('Population ' + key + ': counts disagree across evidence batches.');
    population[key] = values.length === 1 ? values[0] : null;
  }
  const exceptions = group(
    outputs.flatMap((output) => output.exceptions),
    (item) => item.reference,
  ).map(([reference, all]) => {
    const dispositions = unique(all.map((item) => item.disposition));
    if (dispositions.length > 1)
      conflicts.push(reference + ': exception dispositions disagree across evidence batches.');
    return {
      ...all[0],
      reference,
      description: note(
        all.map((item) => item.description),
        1500,
      ),
      closure_impact: note(
        all.map((item) => item.closure_impact),
        1500,
      ),
      disposition: dispositions.includes('open') ? ('open' as const) : ('resolved' as const),
      source_refs: unique(all.flatMap((item) => item.source_refs)),
    };
  });
  return {
    checklist,
    engine,
    judgements,
    population,
    exceptions,
    summary: note(
      outputs.map((output) => output.summary),
      2000,
    ),
    next_actions: note(
      outputs.map((output) => output.next_actions),
      2000,
    ),
    limitations: unique(outputs.flatMap((output) => output.limitations)).slice(0, 20),
    conflicts: unique(conflicts).slice(0, 20),
  };
}
