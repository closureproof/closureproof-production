import type { ManualFinding } from '../lib/manual-api';
import type { ReviewSources } from '../features/review-reuse';
import { Field } from './ui';

export function ReviewSourcesEditor({
  finding,
  value,
  onChange,
}: {
  finding: ManualFinding;
  value: ReviewSources;
  onChange: (value: ReviewSources) => void;
}) {
  const files = (finding.evidence || []).filter(
    (file) =>
      !finding.evidence?.some((next) => next.supersedesId === file.id) &&
      !['rejected', 'insufficient'].includes(file.disposition),
  );
  return (
    <section
      data-review-sources
      className="space-y-4 rounded-xl border border-accent/30 bg-soft/30 p-4"
    >
      <h3 className="text-sm font-semibold">Reuse review answers</h3>
      <p className="text-xs leading-6 text-muted">
        Use your scope, cause, exception, operating-history and retest answers in the engine. Record
        their shared basis and sources once. Additional answers below use these sources unless you
        choose different references. Category-specific decisions still need your assessment.
      </p>
      <label className="flex items-start gap-3 text-xs leading-6">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
        Use my review answers and the sources below in the assessment.
      </label>
      {value.enabled && (
        <>
          <Field label="Shared assessment basis">
            <textarea
              data-source-input="basis"
              rows={2}
              maxLength={2000}
              value={value.basis}
              onChange={(event) => onChange({ ...value, basis: event.target.value })}
              placeholder="Explain the basis supporting the review decisions being reused."
            />
          </Field>
          <Field label="Shared source location">
            <input
              data-source-input="locator"
              maxLength={500}
              value={value.locator}
              onChange={(event) => onChange({ ...value, locator: event.target.value })}
              placeholder="Document sections, pages or record references"
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold">Shared supporting evidence</legend>
            {files.map((file) => (
              <label key={file.id} className="flex items-start gap-3 text-xs leading-6">
                <input
                  data-source-input="evidence"
                  type="checkbox"
                  checked={value.evidenceIds.includes(file.id)}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      evidenceIds: event.target.checked
                        ? [...value.evidenceIds, file.id]
                        : value.evidenceIds.filter((id) => id !== file.id),
                    })
                  }
                />
                {file.filename} · v{file.version}
              </label>
            ))}
          </fieldset>
          <p className="text-xs leading-6 text-muted">
            Operating dates and cycles reuse the values you enter above. Unknown answers stay
            unknown; completed retests still require an explicit assessment of their result and
            independence.
          </p>
        </>
      )}
    </section>
  );
}
