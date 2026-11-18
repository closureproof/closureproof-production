import { useState } from 'react';
import {
  isoChecklistTasks,
  isoChecklistManifest,
  isoProtocolTemplates,
  ISO_PROTOCOL_VERSION,
  type ISOChecklistTask,
} from '../features/iso27001';
import { manualApi, type ManualFinding } from '../lib/manual-api';
import { useWorkspace } from '../app/WorkspaceProvider';
import { Badge, Button, Card, Field, Notice, PageHeader } from './ui';

export function ChecklistSource({ task }: { task: ISOChecklistTask }) {
  return (
    <div className="my-4 min-w-0 space-y-4 text-xs leading-6 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap gap-2">
        <Badge>ISO 27001</Badge>
        <Badge>{task.reference}</Badge>
        <Badge>{task.requirement} in source</Badge>
        <Badge>PDF p. {task.page}</Badge>
      </div>
      <p>
        <strong>Evidence required:</strong> {task.evidence}
      </p>
      <p className="text-muted">
        <strong>Source review frequency:</strong> {task.frequency}
      </p>
      <details>
        <summary className="cursor-pointer font-semibold text-accent">
          Source verification steps ({task.steps.length})
        </summary>
        <ol className="mt-3 space-y-3">
          {task.steps.map((step) => (
            <li key={step.id}>
              <span className="font-mono text-accent">{step.id}</span>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-muted">
          {task.sourceRow} · Source mappings are indicative. Review applicability against the
          finding scope.
        </p>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold text-accent">
          Source preparation guidance and example
        </summary>
        <p className="mt-3">{task.preparation}</p>
        <p className="mt-3 text-muted">{task.example}</p>
        <p className="mt-3 text-muted">Examples are guidance, not submitted evidence.</p>
      </details>
    </div>
  );
}

export function ChecklistScope({
  finding,
  onSaved,
}: {
  finding: ManualFinding;
  onSaved: () => Promise<void>;
}) {
  const template = isoProtocolTemplates.find((protocol) => protocol.code === finding.protocol_code);
  const mappedIds = template?.checks.map((check) => check.sourceTask.id) || [];
  const currentIds = finding.protocol.checks.flatMap((check) =>
    check.sourceTask ? [check.sourceTask.id] : [],
  );
  const [selected, setSelected] = useState<string[]>(currentIds.length ? currentIds : mappedIds);
  const [search, setSearch] = useState('');
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const w = useWorkspace();
  const earlier = finding.protocol.version !== ISO_PROTOCOL_VERSION;
  const shown = isoChecklistTasks.filter(
    (task) =>
      (all || mappedIds.includes(task.id) || selected.includes(task.id)) &&
      `${task.id} ${task.title} ${task.reference}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function apply() {
    setBusy(true);
    setError('');
    try {
      await manualApi.applyChecklist(finding.id, finding.revision, selected);
      await onSaved();
      await w.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update checklist.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <details open={earlier}>
        <summary className="cursor-pointer font-semibold">
          {earlier
            ? 'Apply the ISO 27001 checklist to this finding'
            : 'Checklist scope · ' + currentIds.length + ' selected items'}
        </summary>
        <p className="mt-4 text-sm leading-6 text-muted">
          The {template?.title || 'selected'} category stays in place. Select the items relevant to
          this finding; additional items are available from the full library. Applying a changed
          scope creates a new revision and retains earlier reviews. Save any draft first.
        </p>
        <div className="my-5 grid gap-4 sm:grid-cols-2">
          <Field label="Search checklist scope">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Task reference, title or control"
            />
          </Field>
          <label className="flex items-center gap-3 text-xs">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Show all 153 ISO 27001 tasks
          </label>
        </div>
        <div className="max-h-80 space-y-2 overflow-auto rounded-xl border border-line p-4">
          {shown.map((task) => (
            <label className="flex items-start gap-3 py-2 text-xs leading-6" key={task.id}>
              <input
                className="mt-1"
                type="checkbox"
                checked={selected.includes(task.id)}
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked ? [...ids, task.id] : ids.filter((id) => id !== task.id),
                  )
                }
              />
              <span>
                <strong>
                  {task.id} · {task.title}
                </strong>
                <span className="block text-muted">
                  {task.reference} · {task.requirement} in source · p. {task.page}
                </span>
              </span>
            </label>
          ))}
          {!shown.length && <p className="text-sm text-muted">No matching checklist items.</p>}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" disabled={busy || !selected.length} onClick={apply}>
            {busy ? 'Applying…' : 'Apply selected checklist'}
          </Button>
          <Button secondary type="button" onClick={() => setSelected(mappedIds)}>
            Use category defaults
          </Button>
          <span className="text-xs text-muted">{selected.length} selected</span>
        </div>
        {error && (
          <div className="mt-4">
            <Notice error>{error}</Notice>
          </div>
        )}
      </details>
    </Card>
  );
}

export function ISOProtocolLibrary() {
  const [tab, setTab] = useState<'templates' | 'library'>('templates');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [requirement, setRequirement] = useState('');
  const categories = [
    ...new Set(isoChecklistTasks.map((task) => task.area + ' / ' + task.category)),
  ];
  const filtered = isoChecklistTasks.filter(
    (task) =>
      (!category || task.area + ' / ' + task.category === category) &&
      (!requirement || task.requirement === requirement) &&
      `${task.id} ${task.title} ${task.reference} ${task.evidence}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="ISO 27001"
        title="Closure protocols"
        description="Your ten finding categories, with checklist-backed evidence requirements and review steps."
      />
      <div className="mb-6 flex flex-wrap gap-3" role="tablist" aria-label="Protocol library views">
        <button
          role="tab"
          aria-selected={tab === 'templates'}
          onClick={() => setTab('templates')}
          className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold"
        >
          Finding templates (10)
        </button>
        <button
          role="tab"
          aria-selected={tab === 'library'}
          onClick={() => setTab('library')}
          className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold"
        >
          ISO 27001 checklist (153)
        </button>
      </div>
      <p className="mb-6 text-xs leading-6 text-muted">
        153 workbook tasks · 626 source steps. Source references are indicative; “Required” is the
        workbook label. Apply only the items relevant to the finding and agreed scope.
      </p>
      {tab === 'templates' ? (
        <div className="grid items-start gap-5 md:grid-cols-2">
          {isoProtocolTemplates.map((protocol) => (
            <Card key={protocol.code}>
              <Badge>{protocol.version}</Badge>
              <h2 className="mt-4 font-display text-xl font-semibold">{protocol.title}</h2>
              <p className="mt-2 text-xs text-muted">
                {protocol.checks.length} mapped ISO 27001 items · category retained
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-accent">
                  View mapped checklist items
                </summary>
                <div className="mt-4 divide-y divide-line">
                  {protocol.checks.map((check) => (
                    <details className="py-4" key={check.id}>
                      <summary className="cursor-pointer text-sm font-semibold">
                        {check.label}
                      </summary>
                      <p className="mt-3 text-xs leading-6 text-muted">{check.guidance}</p>
                      <ChecklistSource task={check.sourceTask} />
                    </details>
                  ))}
                </div>
              </details>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Card>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Search ISO checklist">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Task, control or evidence"
                />
              </Field>
              <Field label="Workbook category">
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Source requirement">
                <select value={requirement} onChange={(e) => setRequirement(e.target.value)}>
                  <option value="">All labels</option>
                  {['Required', 'Optional', 'Alternative'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="mt-4 text-xs text-muted">{filtered.length} matching items</p>
          </Card>
          <div className="mt-5 space-y-4">
            {filtered.map((task) => (
              <Card key={task.id}>
                <details>
                  <summary className="cursor-pointer font-semibold">
                    {task.id} · {task.title}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-muted">{task.objective}</p>
                  <ChecklistSource task={task} />
                </details>
              </Card>
            ))}
            {!filtered.length && <p className="text-sm text-muted">No matching checklist items.</p>}
          </div>
          <p className="mt-6 text-xs leading-6 text-muted">
            Source: <span className="[overflow-wrap:anywhere]">{isoChecklistManifest.source}</span>.
            SOC 2-only and ISO 27701-only tasks are excluded. The catalogue is not a claim of
            complete certification coverage.
          </p>
        </>
      )}
    </>
  );
}
