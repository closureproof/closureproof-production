import { Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { validateDemoFile } from '../lib/manual-api';
import { Button, Field, Notice } from './ui';
export interface SubmissionAttachment {
  id: string;
  file: File;
  supersedesId?: string;
  evidenceType: string;
  description: string;
  sourceSystem: string;
  sourceAccount: string;
  coveredResources: string;
  submittedBy: string;
  capturedAt: string;
  periodStart: string;
  periodEnd: string;
}
type Details = Omit<SubmissionAttachment, 'id' | 'file'>;
const emptyDetails = (): Details => ({
  evidenceType: '',
  description: '',
  sourceSystem: '',
  sourceAccount: '',
  coveredResources: '',
  submittedBy: 'Workspace participant',
  capturedAt: '',
  periodStart: '',
  periodEnd: '',
});
export function SubmissionEvidence({
  items,
  onChange,
  locked,
  onDraftChange,
  uploadContext = 'finding',
  existingEvidence = [],
}: {
  existingEvidence?: { id: string; filename: string; version: number }[];
  uploadContext?: 'finding' | 'remediation';
  items: SubmissionAttachment[];
  onChange: (items: SubmissionAttachment[]) => void;
  locked: boolean;
  onDraftChange: (open: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const fields = useRef<HTMLFieldSetElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  function start(button: HTMLButtonElement) {
    const form = button.closest('form');
    const value = (name: string) =>
      form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value || '';
    setDetails({
      ...emptyDetails(),
      sourceAccount: value('account_reference'),
      coveredResources: value('resources'),
    });
    setFile(null);
    setEditing(null);
    setError('');
    setOpen(true);
    onDraftChange(true);
  }
  function close() {
    setOpen(false);
    setFile(null);
    setEditing(null);
    setError('');
    onDraftChange(false);
  }
  function edit(item: SubmissionAttachment) {
    setDetails(item);
    setFile(item.file);
    setEditing(item.id);
    setError('');
    setOpen(true);
    onDraftChange(true);
  }
  async function add() {
    setError('');
    const invalid = Array.from(
      fields.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea') ||
        [],
    ).find((field) => field.willValidate && !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    if (!file) {
      setError('Choose an evidence file.');
      return;
    }
    if (details.periodStart && details.periodEnd && details.periodStart > details.periodEnd) {
      setError('Coverage period end must be on or after its start.');
      return;
    }
    const others = items.filter((item) => item.id !== editing);
    if (
      others.length >= 30 ||
      others.reduce((total, item) => total + item.file.size, 0) + file.size > 250 * 1024 * 1024
    ) {
      setError('Use at most 30 files totalling 250 MB.');
      return;
    }
    if (
      others.some(
        (item) =>
          item.file.name === file.name &&
          item.file.size === file.size &&
          item.file.lastModified === file.lastModified,
      )
    ) {
      setError('This file is already in the evidence list. Edit its existing entry instead.');
      return;
    }
    setChecking(true);
    try {
      await validateDemoFile(file);
      const item = { ...details, id: editing || crypto.randomUUID(), file };
      onChange(editing ? items.map((row) => (row.id === editing ? item : row)) : [...items, item]);
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The evidence file could not be added.');
    } finally {
      setChecking(false);
    }
  }
  const update = (key: keyof Details, value: string) =>
    setDetails((current) => ({ ...current, [key]: value }));
  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-line p-5">
      <h2 className="font-display text-xl font-semibold">Remediation evidence</h2>
      <p className="text-xs leading-6 text-muted">
        Add a file and its details to the evidence list, then add another if needed.{' '}
        {uploadContext === 'remediation'
          ? 'Files upload when you submit this remediation response.'
          : 'Files upload when you submit the finding.'}{' '}
        PDF, DOCX, PNG, JPG, CSV, JSON or TXT · 25 MB each · up to 30 files / 250 MB.
      </p>
      {items.length > 0 && (
        <div aria-label="Evidence list" className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-line p-4">
              <h3 className="break-all text-sm font-semibold">{item.file.name}</h3>
              <p className="mt-2 text-xs leading-6">
                {item.evidenceType} · {item.sourceSystem} · {item.sourceAccount}
                <br />
                {item.description}
              </p>
              <p className="mt-2 text-xs text-muted">
                {uploadContext === 'remediation'
                  ? 'Ready to upload with the remediation response'
                  : 'Ready to upload with the finding'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  secondary
                  size="compact"
                  type="button"
                  aria-label={`Edit ${item.file.name}`}
                  disabled={locked || open}
                  onClick={() => edit(item)}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  secondary
                  size="compact"
                  tone="danger"
                  type="button"
                  aria-label={`Remove ${item.file.name}`}
                  disabled={locked || open}
                  onClick={() => onChange(items.filter((row) => row.id !== item.id))}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {!open && (
        <Button
          secondary
          type="button"
          disabled={locked}
          onClick={(event) => start(event.currentTarget)}
        >
          {items.length ? 'Add more evidence' : 'Add evidence'}
        </Button>
      )}
      {open && (
        <fieldset
          ref={fields}
          disabled={locked || checking}
          className="space-y-4 rounded-xl border border-line p-4"
        >
          <legend className="px-2 font-semibold">
            {editing ? 'Edit evidence details' : 'Add evidence details'}
          </legend>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-accent/30 p-4">
            <p className="min-w-0 flex-1 break-all text-xs">{file?.name || 'No file selected'}</p>
            <Button secondary type="button" onClick={() => input.current?.click()}>
              Browse evidence file
            </Button>
            <input
              ref={input}
              aria-label="Evidence file to add"
              type="file"
              accept=".pdf,.docx,.png,.jpg,.jpeg,.csv,.json,.txt"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                event.target.value = '';
                setError('');
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Evidence type">
              <input
                required
                minLength={2}
                maxLength={100}
                value={details.evidenceType}
                onChange={(e) => update('evidenceType', e.target.value)}
              />
            </Field>
            <Field label="Submitted by">
              <input readOnly value={details.submittedBy} />
            </Field>
            <Field label="Source system">
              <input
                required
                minLength={2}
                maxLength={200}
                value={details.sourceSystem}
                onChange={(e) => update('sourceSystem', e.target.value)}
              />
            </Field>
            <Field label="Source account / redacted reference">
              <input
                required
                minLength={2}
                maxLength={200}
                value={details.sourceAccount}
                onChange={(e) => update('sourceAccount', e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Covered identities / resources">
                <textarea
                  required
                  minLength={2}
                  maxLength={5000}
                  value={details.coveredResources}
                  onChange={(e) => update('coveredResources', e.target.value)}
                />
              </Field>
            </div>
            {existingEvidence.length > 0 && (
              <Field label="Replaces evidence (optional)">
                <select
                  value={details.supersedesId || ''}
                  onChange={(event) => update('supersedesId', event.target.value)}
                >
                  <option value="">Additional supporting evidence</option>
                  {existingEvidence.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.filename} · v{file.version}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Capture date (if known)">
              <input
                type="date"
                value={details.capturedAt}
                onChange={(e) => update('capturedAt', e.target.value)}
              />
            </Field>
            <Field label="Coverage period start (optional)">
              <input
                type="date"
                value={details.periodStart}
                onChange={(e) => update('periodStart', e.target.value)}
              />
            </Field>
            <Field label="Coverage period end (optional)">
              <input
                type="date"
                value={details.periodEnd}
                onChange={(e) => update('periodEnd', e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Evidence description">
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={3}
                  value={details.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </Field>
            </div>
          </div>
          {error && <Notice error>{error}</Notice>}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => {
                void add();
              }}
            >
              {checking
                ? 'Checking file…'
                : editing
                  ? 'Save evidence details'
                  : 'Add to evidence list'}
            </Button>
            <Button secondary type="button" onClick={close}>
              Cancel evidence
            </Button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
