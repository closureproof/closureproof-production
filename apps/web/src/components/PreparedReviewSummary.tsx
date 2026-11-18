import { assessmentMethod } from '@closureproof/assessment-engine/protocol-catalogue';
import { activeSections } from '../features/control-scope';
import { JUDGEMENT_VERSION } from '../features/review-judgement';
import type { ManualFinding } from '../lib/manual-api';
import type { ReviewProposal } from '../lib/ai-review-contract';
import { Button } from './ui';

export function preparationAttention(proposal: ReviewProposal, finding: ManualFinding) {
  const labels = new Map<string, string>([
    ...finding.protocol.checks.map((check) => [check.id, check.label] as [string, string]),
    ...(assessmentMethod(finding.protocol.code)?.fields || []).map(
      (field) => [field.id, field.label] as [string, string],
    ),
    ...activeSections(finding.protocol, { version: JUDGEMENT_VERSION }).flatMap((section) =>
      section.fields.map((field) => [field.key, field.label] as [string, string]),
    ),
    ['operation_required', 'Operating-history requirement'],
    ['operation_requirement', 'Operating-history requirement'],
    ['retest_required', 'Independent retest requirement'],
    ['retest_requirement', 'Independent retest requirement'],
  ]);
  const decisions: string[] = [];
  const limitations: string[] = [];
  for (const note of [
    ...(proposal.prepared.sourceWarnings || []),
    ...proposal.output.limitations,
  ]) {
    const match = note.match(
      /^([\w-]+): (?:uncited proposed (?:value|judgement) was left (?:unknown|unresolved)|no supporting citation was supplied; retained as Not assessed)\.$/,
    );
    if (match) {
      const label = labels.get(match[1]) || match[1].replace(/^iso-/, '').replaceAll('_', ' ');
      decisions.push(`${label}: supporting evidence is needed before this can be assessed.`);
    } else limitations.push(note);
  }
  return {
    decisions: [...new Set(decisions)],
    limitations: [...new Set(limitations)],
    conflicts: [...new Set(proposal.output.conflicts)],
  };
}
export function PreparedReviewSummary({
  proposal,
  finding,
  disabled,
  onApply,
}: {
  proposal: ReviewProposal;
  finding: ManualFinding;
  disabled: boolean;
  onApply: () => void;
}) {
  const attention = preparationAttention(proposal, finding);
  const needsAttention = attention.decisions.length + attention.conflicts.length > 0;
  return (
    <section aria-label="Prepared review draft" className="space-y-4 border-t border-line pt-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p role="status" className="text-sm font-semibold text-accent">
            Draft prepared
          </p>
          <p className="mt-1 text-xs leading-6 text-muted">
            {proposal.prepared.checks.length} checklist items ·{' '}
            {proposal.prepared.sourceKeys.length} supporting facts
          </p>
          <p className="mt-1 text-xs leading-6">
            {needsAttention
              ? 'Ready to use. Some assessment items need attention.'
              : 'Ready to use. Review the prepared answers before completing the assessment.'}
          </p>
        </div>
        <Button type="button" disabled={disabled} onClick={onApply}>
          Use draft in review
        </Button>
      </div>
      <p className="text-xs leading-6 text-muted">
        Applies the prepared checklist, judgement and assessment answers to your editable review.
        Completed assessments remain unchanged.
      </p>
      <details className="rounded-xl border border-line p-3">
        <summary className="cursor-pointer text-xs font-semibold">Evidence summary</summary>
        <p className="mt-3 whitespace-pre-wrap text-xs leading-6">{proposal.output.summary}</p>
      </details>
      {needsAttention && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h4 className="text-sm font-semibold">Items needing attention</h4>
          <p className="text-xs leading-6 text-muted">
            Preparation completed. Unsupported answers remain unassessed. You can use the draft,
            then address these items or record the evidence needed.
          </p>
          {attention.decisions.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs leading-6">
              {attention.decisions.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          {attention.conflicts.length > 0 && (
            <div>
              <p className="text-xs font-semibold">Conflicting evidence</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-6">
                {attention.conflicts.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
