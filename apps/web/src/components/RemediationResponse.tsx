import { useEffect, useRef, useState, type FormEvent } from 'react';
import { manualApi, validateDemoFile, type ManualFinding } from '../lib/manual-api';
import { workflowApi, type WorkflowData } from '../lib/workflow-api';
import { useWorkspace } from '../app/WorkspaceProvider';
import { emptyScope, type ScopeRequest } from '../features/control-scope';
import { ScopeSelection } from './ControlReviewScope';
import { SubmissionEvidence, type SubmissionAttachment } from './SubmissionEvidence';
import { Button, Card, Field, Notice } from './ui';

export function RemediationResponse({
  finding,
  onSaved,
}: {
  finding: ManualFinding;
  onSaved: () => Promise<void>;
}) {
  const [data, setData] = useState<WorkflowData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [items, setItems] = useState<SubmissionAttachment[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [correctScope, setCorrectScope] = useState(false);
  const [scope, setScope] = useState<ScopeRequest>(finding.protocol.review_scope || emptyScope());
  const command = useRef<{ revision: number; fields: Record<string, string> } | null>(null);
  const request = useRef(crypto.randomUUID());
  const basis = useRef<Record<string, string> | null>(null);
  const scopeSaved = useRef(false);
  const savedFiles = useRef(new Set<string>());
  const originalFiles = useRef(new Set(finding.evidence?.map((file) => file.id) || []));
  const w = useWorkspace();
  useEffect(() => {
    workflowApi
      .data(finding.id)
      .then(setData)
      .catch((error) => setError(error.message));
  }, [finding.id]);
  const requests =
    data?.followups.filter(
      (item) => item.cycle_number === finding.cycleNumber && item.status === 'open',
    ) || [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (editorOpen) {
      setError(
        'Add the evidence to the list or cancel the unfinished evidence entry before submitting.',
      );
      return;
    }
    if (!data) {
      setError('Wait for the reviewer requests to load before submitting.');
      return;
    }
    const entered = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    if (!basis.current) basis.current = entered;
    const fields = basis.current;
    setBusy(true);
    setStarted(true);
    try {
      if (command.current) {
        await workflowApi.action(
          finding.id,
          command.current.revision,
          null,
          'resubmit',
          command.current.fields,
          request.current,
        );
        setDone(true);
        await onSaved();
        await w.refresh();
        return;
      }
      for (const item of items) await validateDemoFile(item.file);
      let current = await manualApi.finding(finding.id);
      if (!['changes_requested', 'retest_pending'].includes(current.lifecycle))
        throw Error(
          'This finding is no longer awaiting remediation. Refresh to view its current review cycle.',
        );
      if (correctScope && !scopeSaved.current) {
        current = await manualApi.amendScope(
          current.id,
          current.revision,
          scope,
          fields.actor,
          fields.scope_reason,
        );
        scopeSaved.current = true;
      }
      for (const item of items) {
        if (savedFiles.current.has(item.id)) continue;
        const { digest } = await validateDemoFile(item.file);
        const recovered = current.evidence?.find(
          (file) =>
            !originalFiles.current.has(file.id) &&
            file.filename === item.file.name &&
            file.sha256 === digest &&
            file.metadata.source_system === item.sourceSystem &&
            file.metadata.source_account === item.sourceAccount &&
            file.metadata.description === item.description,
        );
        if (!recovered) {
          await manualApi.upload(current.id, item.file, {
            revision: current.revision,
            evidence_type: item.evidenceType,
            source_system: item.sourceSystem,
            source_account: item.sourceAccount,
            covered_resources: item.coveredResources,
            description: item.description,
            submitted_by: item.submittedBy,
            captured_at: item.capturedAt || null,
            period_start: item.periodStart || null,
            period_end: item.periodEnd || null,
            supersedes_id: item.supersedesId || null,
          });
        }
        savedFiles.current.add(item.id);
        current = await manualApi.finding(current.id);
      }
      const latestRequests = (await workflowApi.data(current.id)).followups.filter(
        (item) => item.cycle_number === current.cycleNumber && item.status === 'open',
      );
      if (
        JSON.stringify(latestRequests.map((item) => item.id).sort()) !==
        JSON.stringify(requests.map((item) => item.id).sort())
      )
        throw Error(
          'The reviewer requests changed while you were responding. Reload and check the latest instructions before resubmitting.',
        );
      command.current = {
        revision: current.revision,
        fields: { ...fields, request_ids: JSON.stringify(requests.map((item) => item.id)) },
      };
      await workflowApi.action(
        current.id,
        command.current.revision,
        null,
        'resubmit',
        command.current.fields,
        request.current,
      );
      setDone(true);
      await onSaved();
      await w.refresh();
    } catch (error) {
      setError(
        (error instanceof Error
          ? error.message
          : 'The remediation response could not be submitted.') +
          ' Saved documents remain attached to this finding. Retry to finish without uploading them again.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <Notice>
        Remediation submitted for review. Your response and evidence remain linked to this finding.
        A reviewer will assess the updates and provide a recommendation.
      </Notice>
    );
  return (
    <Card>
      <h2 className="font-display text-xl font-semibold">Remediation response</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Respond to the reviewer’s request, make any scope correction and add supporting evidence.
        Submit everything for the next review cycle.
      </p>
      <section className="mt-5 space-y-3">
        <h3 className="font-semibold">Reviewer’s request</h3>
        {!data && !error && <p className="text-xs text-muted">Loading reviewer requests…</p>}
        {data && !requests.length && (
          <Notice>
            No detailed request has been recorded for this finding.{' '}
            {finding.reviews?.find(
              (review) =>
                review.status === 'completed' && review.cycleNumber === finding.cycleNumber,
            )?.clarification_request ||
              'Ask the reviewer to record the actions and evidence needed.'}
          </Notice>
        )}
        {requests.map((item) => (
          <div key={item.id} className="rounded-xl border border-line p-4 text-sm leading-7">
            <p className="font-semibold">
              {item.kind === 'retest' ? 'Retest requested' : 'Remediation requested'}
            </p>
            <p>
              Requested by: {item.data.actor} · {new Date(item.created_at).toLocaleString('en-GB')}
            </p>
            <p className="whitespace-pre-wrap">{item.data.requested_actions}</p>
            {item.data.scope_correction && (
              <p className="whitespace-pre-wrap">Scope correction: {item.data.scope_correction}</p>
            )}
            <p className="whitespace-pre-wrap">
              Evidence required: {item.data.evidence_requirements}
            </p>
            <p>
              Owner: {item.data.owner}
              {item.data.due_date ? ' · Requested date: ' + item.data.due_date : ''}
            </p>
          </div>
        ))}
      </section>
      {error && <Notice error>{error}</Notice>}
      <form onSubmit={submit} className="mt-6 space-y-6">
        <input type="hidden" name="account_reference" value={finding.account_reference} />
        <input type="hidden" name="resources" value={finding.resources} />
        <fieldset disabled={busy || started} className="space-y-5">
          <legend className="mb-4 font-semibold">Response and corrective actions</legend>
          <Field label="Your name">
            <input name="actor" required minLength={2} maxLength={200} />
          </Field>
          <Field label="Changes and response to requests">
            <textarea name="change_summary" required minLength={10} maxLength={5000} rows={4} />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={correctScope}
              onChange={(event) => setCorrectScope(event.target.checked)}
            />
            Include a scope correction
          </label>
          {correctScope && (
            <section className="space-y-4 rounded-xl border border-line p-4">
              <h3 className="font-semibold">Scope correction</h3>
              <ScopeSelection
                category={finding.protocol_code}
                value={scope}
                onChange={setScope}
                amendments
              />
              <Field label="Scope correction reason">
                <textarea name="scope_reason" required minLength={10} maxLength={2000} />
              </Field>
            </section>
          )}
          <SubmissionEvidence
            items={items}
            onChange={setItems}
            locked={busy || started}
            onDraftChange={setEditorOpen}
            uploadContext="remediation"
            existingEvidence={(finding.evidence || []).filter(
              (file) => !finding.evidence?.some((next) => next.supersedesId === file.id),
            )}
          />
        </fieldset>
        <section className="border-t border-line pt-5">
          <h3 className="font-semibold">Submit for reassessment</h3>
          <p className="my-3 text-xs leading-6 text-muted">
            Your response and listed evidence will be saved against this finding before it returns
            to the reviewer queue. Previous assessments and documents remain in history.
          </p>
          <Button disabled={busy || !data}>
            {busy
              ? 'Submitting remediation…'
              : started
                ? 'Retry remediation submission'
                : 'Submit remediation for review'}
          </Button>
        </section>
      </form>
    </Card>
  );
}
