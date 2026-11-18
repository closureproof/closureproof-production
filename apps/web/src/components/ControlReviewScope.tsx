import { useState, type FormEvent } from 'react';
import {
  scopeCatalogue,
  controlThemes,
  emptyScope,
  previewScope,
  scopeModules,
  type ScopeRequest,
} from '../features/control-scope';
import { isoChecklistTasks } from '../features/iso27001';
import { manualApi, type ManualFinding } from '../lib/manual-api';
import { useWorkspace } from '../app/WorkspaceProvider';
import { Badge, Button, Card, Field, Notice } from './ui';

export function ScopeSelection({
  category,
  value,
  onChange,
  amendments = false,
}: {
  category: string;
  value: ScopeRequest;
  onChange: (value: ScopeRequest) => void;
  amendments?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [section, setSection] = useState('suggested');
  const preview = previewScope(category, value);
  const patch = (next: Partial<ScopeRequest>) => onChange({ ...value, ...next });
  const controls = scopeCatalogue.controls.filter(
    (c) =>
      (section === 'all' ||
        (section === 'suggested' ? c.categories.includes(category) : c.theme === section)) &&
      `${c.id} ${c.title}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const selectedControls = scopeCatalogue.controls.filter((c) => value.control_ids.includes(c.id));
  const selectControl = (id: string, selected: boolean) =>
    patch({
      control_ids: selected
        ? [...value.control_ids, id]
        : value.control_ids.filter((value) => value !== id),
      excluded_tasks: {},
      excluded_modules: {},
    });
  const sectionOptions = [
    {
      id: 'suggested',
      label: 'Suggested',
      description:
        'Controls suggested for the selected finding category. Browse any section to include additional controls.',
    },
    ...controlThemes.map((theme) => ({
      id: theme.name,
      label: `${theme.name} (${scopeCatalogue.controls.filter((c) => c.theme === theme.name).length})`,
      description: theme.description,
    })),
    {
      id: 'all',
      label: 'All controls (93)',
      description:
        'All controls from the supplied Statement of Applicability, across the four themes.',
    },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">ISO 27001 controls</h3>
        <p className="mt-2 text-xs leading-6 text-muted">
          Choose the controls this finding concerns. These determine the checklist and review
          sections; the reviewer confirms their relevance.
        </p>
      </div>
      <div className="space-y-3">
        <div role="group" aria-label="Control sections" className="flex flex-wrap gap-2">
          {sectionOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={section === option.id}
              onClick={() => setSection(option.id)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${section === option.id ? 'border-charcoal bg-charcoal text-white' : 'border-line bg-white text-charcoal hover:border-accent/50'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs leading-6 text-muted">
          {sectionOptions.find((option) => option.id === section)?.description}
        </p>
      </div>
      <Field label="Search ISO controls">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (section === 'suggested' && e.target.value) setSection('all');
          }}
          placeholder={
            section === 'suggested' || section === 'all'
              ? 'Search by control ID or title'
              : `Search ${section.toLowerCase()} controls`
          }
        />
      </Field>
      <section aria-label="Selected ISO controls" className="rounded-xl border border-line p-4">
        <h4 className="text-xs font-semibold">Selected controls ({selectedControls.length})</h4>
        {selectedControls.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedControls.map((c) => (
              <div
                key={c.id}
                className="max-w-full rounded-lg border border-accent/20 bg-soft/40 px-3 py-2 text-xs leading-6"
              >
                <p className="break-words font-semibold">
                  {c.id} · {c.title}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-muted">{c.theme}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${c.id}`}
                    className="rounded-md px-2 font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-accent"
                    onClick={() => selectControl(c.id, false)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-6 text-muted">
            No controls selected. Choose controls from any section or explain a provisional scope
            below.
          </p>
        )}
      </section>
      <p role="status" aria-live="polite" className="text-xs text-muted">
        {controls.length} matching controls · {selectedControls.length} selected across all sections
      </p>
      <p className="text-xs leading-6 text-muted">
        Controls labelled “Custom checklist” need a reviewer to define the checks for this finding.
      </p>
      <div
        role="group"
        aria-label="Available ISO controls"
        className="max-h-64 overflow-y-auto rounded-xl border border-line p-4"
      >
        {controls.map((c) => (
          <label className="flex items-start gap-3 py-2 text-xs leading-6" key={c.id}>
            <input
              className="mt-1"
              type="checkbox"
              checked={value.control_ids.includes(c.id)}
              onChange={(e) => selectControl(c.id, e.target.checked)}
            />
            <span>
              <strong>
                {c.id} · {c.title}
              </strong>
              {c.status === 'configured' ? (
                <span className="block text-muted">{c.task_ids.length} checklist items</span>
              ) : (
                <span className="mt-1 inline-block rounded-md bg-soft px-2 py-0.5 text-[10px] text-muted">
                  Custom checklist
                </span>
              )}
            </span>
          </label>
        ))}
        {!controls.length && (
          <p className="text-xs leading-6 text-muted">
            No controls match this view. Clear your search or choose another section. Selections in
            other sections are retained.
          </p>
        )}
      </div>
      <Button
        secondary
        type="button"
        onClick={() => patch({ control_ids: [], excluded_tasks: {}, excluded_modules: {} })}
      >
        Control not yet identified
      </Button>
      {preview.provisional && (
        <>
          <Notice>
            This scope is provisional. Category checks remain until a reviewer identifies the
            control or documents a justified custom scope.
          </Notice>
          <Field label="Reason for provisional scope">
            <textarea
              value={value.unknown_reason}
              required
              minLength={10}
              maxLength={2000}
              rows={2}
              onChange={(e) => patch({ unknown_reason: e.target.value })}
            />
          </Field>
        </>
      )}
      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-2 text-xs font-semibold">Additional review modules</legend>
        {scopeCatalogue.conditional_modules
          .filter(
            (id) => !preview.controls.some((c) => c.modules.includes(id)) && !preview.provisional,
          )
          .map((id) => (
            <label className="my-2 flex items-center gap-3 text-xs" key={id}>
              <input
                type="checkbox"
                checked={value.additional_modules.includes(id)}
                onChange={(e) =>
                  patch({
                    additional_modules: e.target.checked
                      ? [...value.additional_modules, id]
                      : value.additional_modules.filter((m) => m !== id),
                  })
                }
              />
              {scopeModules.find((m) => m.id === id)?.title}
            </label>
          ))}
        <p className="text-xs leading-6 text-muted">
          Core scope, corrective-action, exception and conclusion sections are always included.
        </p>
      </fieldset>
      <div className="rounded-xl border border-accent/20 bg-soft/30 p-4">
        <h3 className="text-sm font-semibold">Review scope preview</h3>
        <p className="mt-2 text-xs leading-6">
          {preview.tasks.length} checklist items · {preview.modules.length} review sections ·
          mapping {value.version}
        </p>
        <p className="mt-2 text-xs leading-6">{preview.modules.map((m) => m.title).join(' · ')}</p>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-accent">
            Checklist and expected evidence
          </summary>
          <div className="mt-3 divide-y divide-line">
            {preview.tasks.map((task) => (
              <div key={task.id} className="py-3 text-xs leading-6">
                <strong>
                  {task.id} · {task.title}
                </strong>
                <p className="text-muted">
                  Included for:{' '}
                  {preview.controls
                    .filter((c) => c.task_ids.includes(task.id))
                    .map((c) => c.id)
                    .join(', ') ||
                    (value.additional_task_ids.includes(task.id)
                      ? 'Added to scope'
                      : 'Provisional category scope')}
                </p>
                <p>Expected evidence: {task.evidence}</p>
              </div>
            ))}
          </div>
        </details>
      </div>
      {amendments && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-accent">
            Amend checklist items and conditional sections
          </summary>
          <p className="mt-3 text-xs leading-6 text-muted">
            Exclusion from assessment scope is separate from a check’s SoA applicability. Explain
            every exclusion. Save a draft before changing scope; earlier drafts remain historical.
          </p>
          <div className="mt-4 space-y-4">
            {preview.baseTaskIds.sort().map((id) => (
              <div key={id}>
                <label className="flex items-start gap-3 text-xs leading-6">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={!(id in value.excluded_tasks)}
                    onChange={(e) => {
                      const excluded = { ...value.excluded_tasks };
                      if (e.target.checked) delete excluded[id];
                      else excluded[id] = '';
                      patch({ excluded_tasks: excluded });
                    }}
                  />
                  <span>
                    {id} · {isoChecklistTasks.find((t) => t.id === id)?.title}
                  </span>
                </label>
                {id in value.excluded_tasks && (
                  <Field label={`Reason to exclude ${id}`}>
                    <textarea
                      required
                      minLength={10}
                      maxLength={2000}
                      value={value.excluded_tasks[id]}
                      onChange={(e) =>
                        patch({ excluded_tasks: { ...value.excluded_tasks, [id]: e.target.value } })
                      }
                    />
                  </Field>
                )}
              </div>
            ))}
            <Field label="Find additional checklist items">
              <input
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Task ID, title or control"
              />
            </Field>
            {taskSearch &&
              isoChecklistTasks
                .filter(
                  (t) =>
                    !preview.baseTaskIds.includes(t.id) &&
                    `${t.id} ${t.title} ${t.reference}`
                      .toLowerCase()
                      .includes(taskSearch.toLowerCase()),
                )
                .map((t) => (
                  <Button
                    secondary
                    type="button"
                    key={t.id}
                    onClick={() => {
                      patch({ additional_task_ids: [...value.additional_task_ids, t.id] });
                      setTaskSearch('');
                    }}
                  >
                    Add {t.id} · {t.title}
                  </Button>
                ))}
            {scopeCatalogue.conditional_modules
              .filter((id) => preview.baseModules.includes(id))
              .map((id) => (
                <div key={id}>
                  <label className="flex items-center gap-3 text-xs">
                    <input
                      type="checkbox"
                      checked={!(id in value.excluded_modules)}
                      onChange={(e) => {
                        const excluded = { ...value.excluded_modules };
                        if (e.target.checked) delete excluded[id];
                        else excluded[id] = '';
                        patch({ excluded_modules: excluded });
                      }}
                    />
                    {scopeModules.find((m) => m.id === id)?.title}
                  </label>
                  {id in value.excluded_modules && (
                    <Field label={`Reason to exclude ${id} module`}>
                      <textarea
                        required
                        minLength={10}
                        maxLength={2000}
                        value={value.excluded_modules[id]}
                        onChange={(e) =>
                          patch({
                            excluded_modules: { ...value.excluded_modules, [id]: e.target.value },
                          })
                        }
                      />
                    </Field>
                  )}
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ControlScopePanel({
  finding,
  onSaved,
  readOnly = false,
}: {
  finding: ManualFinding;
  onSaved: () => Promise<void>;
  readOnly?: boolean;
}) {
  const saved = finding.protocol.review_scope;
  const [value, setValue] = useState<ScopeRequest>(saved || emptyScope());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const w = useWorkspace();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await manualApi.amendScope(
        finding.id,
        finding.revision,
        value,
        String(fields.get('actor')),
        String(fields.get('reason')),
      );
      setEditing(false);
      await onSaved();
      await w.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scope could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl font-semibold">Review scope</h2>
        <Badge>
          {saved?.provisional ? 'Provisional' : saved ? 'Control-based' : 'Existing checklist'}
        </Badge>
      </div>
      {saved ? (
        <>
          <p className="mt-4 text-sm leading-7">
            {saved.controls.map((c) => `${c.id} · ${c.title}`).join('; ') ||
              'Control not yet identified'}
          </p>
          <p className="mt-3 text-xs leading-6 text-muted">
            {finding.protocol.checks.length} checklist items · {saved.version}
            <br />
            {scopeModules
              .filter((m) => saved.modules.includes(m.id))
              .map((m) => m.title)
              .join(' · ')}
          </p>
          <details className="mt-3 text-xs leading-6">
            <summary className="cursor-pointer text-accent">Scope reasons and exclusions</summary>
            <p>
              {saved.reason} · {saved.actor} · {new Date(saved.recorded_at).toLocaleString('en-GB')}
            </p>
            {saved.provisional && <p>Provisional reason: {saved.unknown_reason}</p>}
            {Object.entries(saved.excluded_tasks).map(([id, reason]) => (
              <p key={id}>
                Task {id}: outside assessment scope — {reason}
              </p>
            ))}
            {Object.entries(saved.module_exclusions).map(([id, reason]) => (
              <p key={id}>
                {scopeModules.find((m) => m.id === id)?.title}: outside assessment scope — {reason}
              </p>
            ))}
          </details>
        </>
      ) : (
        <p className="mt-4 text-xs leading-6 text-muted">
          This finding retains its original checklist. Adopt control-based scope explicitly to
          change it.
        </p>
      )}
      {!readOnly && (
        <Button secondary className="mt-4" type="button" onClick={() => setEditing(!editing)}>
          {editing
            ? 'Cancel scope amendment'
            : saved
              ? 'Amend review scope'
              : 'Adopt control-based scope'}
        </Button>
      )}
      {editing && (
        <form className="mt-5 space-y-5 border-t border-line pt-5" onSubmit={save}>
          <Notice>
            Changing scope creates a finding revision and makes earlier assessments historical.
            Completed cases require resubmission before reassessment. Save any open review draft
            first.
          </Notice>
          <ScopeSelection
            category={finding.protocol_code}
            value={value}
            onChange={setValue}
            amendments
          />
          <div className="rounded-xl border border-line p-4 text-xs leading-6">
            <h3 className="font-semibold">Scope change preview</h3>
            {(() => {
              const next = previewScope(finding.protocol_code, value);
              const oldIds = finding.protocol.checks.flatMap((c) =>
                c.sourceTask ? [c.sourceTask.id] : [],
              );
              const newIds = next.tasks.map((t) => t.id);
              return (
                <>
                  <p>
                    Tasks added: {newIds.filter((id) => !oldIds.includes(id)).join(', ') || 'None'}
                  </p>
                  <p>
                    Tasks removed:{' '}
                    {oldIds.filter((id) => !newIds.includes(id)).join(', ') || 'None'}
                  </p>
                  <p>Proposed sections: {next.modules.map((m) => m.title).join(' · ')}</p>
                </>
              );
            })()}
          </div>
          <Field label="Scope amendment recorded by">
            <input name="actor" required minLength={2} maxLength={200} />
          </Field>
          <Field label="Reason for scope amendment">
            <textarea name="reason" required minLength={10} maxLength={2000} />
          </Field>
          <Button disabled={busy || !previewScope(finding.protocol_code, value).tasks.length}>
            {busy ? 'Saving scope…' : 'Confirm review scope change'}
          </Button>
          {error && <Notice error>{error}</Notice>}
        </form>
      )}
    </Card>
  );
}
