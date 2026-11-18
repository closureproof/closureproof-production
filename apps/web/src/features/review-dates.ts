import { normaliseDate } from '@closureproof/document-contracts';
import type { EngineDraft } from '@closureproof/assessment-engine/review-contracts';
import type { ClosureJudgement } from './review-judgement';
export const reviewDateFields = [
  { id: 'deadline', label: 'Finding deadline', judgement: null },
  { id: 'operation_start', label: 'Operating period start', judgement: 'operating_from' },
  { id: 'operation_end', label: 'Operating period end', judgement: 'operating_to' },
  { id: 'retest_date', label: 'Independent retest date', judgement: 'retest_date' },
] as const;
export function reviewDates(
  draft: EngineDraft,
  judgement: ClosureJudgement,
  deadline?: string | null,
) {
  return reviewDateFields
    .filter(
      (field) =>
        field.id === 'deadline' ||
        (field.id.startsWith('operation_') && judgement.operation_requirement === 'Required') ||
        (field.id === 'retest_date' && judgement.retest_status === 'Completed'),
    )
    .map((field) => {
      const entry = draft.entries[field.id];
      const decision = draft.dateDecisions?.[field.id];
      const candidates = [
        ...(decision?.candidates || []),
        ...(field.id === 'deadline' && normaliseDate(deadline)
          ? [{ value: normaliseDate(deadline)!, source: 'Current submitted finding deadline' }]
          : []),
        ...(entry?.value && normaliseDate(entry.value)
          ? [{ value: normaliseDate(entry.value)!, source: entry.locator || 'Prepared assessment' }]
          : []),
        ...(field.judgement && normaliseDate(judgement[field.judgement])
          ? [{ value: normaliseDate(judgement[field.judgement])!, source: 'Reviewer judgement' }]
          : []),
      ].filter(
        (candidate, index, all) =>
          all.findIndex(
            (other) => other.value === candidate.value && other.source === candidate.source,
          ) === index,
      );
      const conflict = new Set(candidates.map((candidate) => candidate.value)).size > 1;
      const value =
        decision?.value ||
        (field.id === 'deadline' ? normaliseDate(deadline) : null) ||
        normaliseDate(entry?.value) ||
        (field.judgement ? normaliseDate(judgement[field.judgement]) : null) ||
        '';
      return {
        ...field,
        candidates,
        conflict,
        value,
        resolved: !!decision && decision.reason.trim().length >= 10,
      };
    });
}
export function populateReviewDates(
  draft: EngineDraft,
  judgement: ClosureJudgement,
  deadline?: string | null,
) {
  const next = { ...draft, entries: { ...draft.entries } };
  const answers = { ...judgement };
  const active = new Set(reviewDates(draft, judgement, deadline).map((date) => date.id));
  if (draft.dateDecisions)
    next.dateDecisions = Object.fromEntries(
      Object.entries(draft.dateDecisions).filter(([id]) =>
        active.has(id as (typeof reviewDateFields)[number]['id']),
      ),
    );
  for (const date of reviewDates(draft, judgement, deadline)) {
    if (date.conflict && !date.resolved) {
      next.dateDecisions = {
        ...next.dateDecisions,
        [date.id]: {
          value: date.value,
          reason: draft.dateDecisions?.[date.id]?.reason || '',
          candidates: date.candidates,
        },
      };
      continue;
    }
    if (!date.value) continue;
    if (date.id !== 'retest_date')
      next.entries[date.id] = {
        ...(next.entries[date.id] || { basis: '', locator: '', evidenceIds: [] }),
        value: date.value,
      };
    if (date.judgement) {
      answers[date.judgement] = date.value;
      const ids = next.entries[date.id]?.evidenceIds || [];
      if (ids.length && date.id.startsWith('operation_'))
        answers.evidence_refs = {
          ...answers.evidence_refs,
          operation: [...new Set([...(answers.evidence_refs?.operation || []), ...ids])],
        };
    }
  }
  return { draft: next, judgement: answers };
}
