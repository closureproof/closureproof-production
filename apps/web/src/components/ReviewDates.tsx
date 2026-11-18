import type { EngineDraft } from '@closureproof/assessment-engine/review-contracts';
import type { ClosureJudgement } from '../features/review-judgement';
import { reviewDates, populateReviewDates } from '../features/review-dates';
import { Field } from './ui';
export function ReviewDates({
  draft,
  judgement,
  deadline,
  onChange,
}: {
  draft: EngineDraft;
  judgement: ClosureJudgement;
  deadline?: string | null;
  onChange: (draft: EngineDraft, judgement: ClosureJudgement) => void;
}) {
  const dates = reviewDates(draft, judgement, deadline).filter(
    (date) =>
      date.id === 'deadline' ||
      date.candidates.length ||
      (date.id.startsWith('operation_') && judgement.operation_requirement === 'Required') ||
      (date.id === 'retest_date' && judgement.retest_status === 'Completed'),
  );
  function change(id: string, value: string, reason: string) {
    const item = dates.find((date) => date.id === id)!;
    const next = {
      ...draft,
      dateDecisions: {
        ...draft.dateDecisions,
        [id]: { value, reason, candidates: item.candidates },
      },
    };
    const result = populateReviewDates(next, judgement, deadline);
    onChange(result.draft, result.judgement);
  }
  return (
    <section data-review-dates className="space-y-4 rounded-xl border border-line p-4">
      <h3 className="text-sm font-semibold">Review dates</h3>
      <p className="text-xs leading-6 text-muted">
        Dates are populated from the finding and prepared evidence. Resolve different dates here
        once; the assessment reuses your selection.
      </p>
      {dates.map((date) => (
        <div key={date.id} className="space-y-3 border-t border-line pt-3">
          <Field label={date.label + ' used in assessment'}>
            <input
              type="date"
              value={date.value}
              onChange={(e) => {
                if (e.target.value)
                  change(date.id, e.target.value, draft.dateDecisions?.[date.id]?.reason || '');
              }}
            />
          </Field>
          {date.candidates.length > 0 && (
            <ul className="space-y-1 text-xs leading-6 text-muted">
              {date.candidates.map((candidate) => (
                <li key={candidate.value + candidate.source}>
                  {candidate.value} · {candidate.source}
                </li>
              ))}
            </ul>
          )}
          {(date.conflict || draft.dateDecisions?.[date.id]) && (
            <Field label={date.label + ': reason for selected date'}>
              <textarea
                rows={2}
                maxLength={2000}
                value={draft.dateDecisions?.[date.id]?.reason || ''}
                onChange={(e) => {
                  if (date.value) change(date.id, date.value, e.target.value);
                }}
                placeholder="Explain which source establishes the applicable date."
              />
            </Field>
          )}
          {date.conflict && !date.resolved && (
            <p className="text-xs text-amber-800">
              Different dates are recorded. Select the applicable date and explain the choice before
              evaluation.
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
