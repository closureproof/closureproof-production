import { RulesTrace } from './RulesAssessment';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from '../lib/navigation';
import { useWorkspace } from '../app/WorkspaceProvider';
import { type ManualFinding } from '../lib/manual-api';
import { workflowApi, type WorkflowData, type ReportRecord } from '../lib/workflow-api';
import {
  generateReport,
  downloadReport,
  downloadPack,
  reportTitle,
} from '../lib/report-generation';
import { Badge, Button, Card, Field, Notice, PageHeader } from './ui';
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'The operation could not be completed.';
const short = (id: string) => id.slice(0, 8).toUpperCase();
export function ReportActions({
  report,
  onChanged,
  automatic = false,
}: {
  report: ReportRecord;
  onChanged: () => Promise<void>;
  automatic?: boolean;
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const started = useRef(false);
  async function run(action: 'generate' | 'pdf' | 'zip') {
    setBusy(action);
    setError('');
    try {
      if (action === 'generate') {
        await generateReport(report.id);
        await onChanged();
      } else if (action === 'pdf') await downloadReport(report);
      else await downloadPack(report);
    } catch (e) {
      setError(message(e));
      await onChanged();
    } finally {
      setBusy('');
    }
  }
  useEffect(() => {
    if (automatic && report.status === 'pending' && !started.current) {
      started.current = true;
      void run('generate');
    }
  }, [automatic, report.id, report.status]);
  const leased =
    report.status === 'generating' &&
    !!report.lease_expires_at &&
    new Date(report.lease_expires_at).getTime() > Date.now();
  return (
    <div className="space-y-4 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{reportTitle(report)}</h3>
          <p className="mt-1 text-xs text-muted">
            Report {short(report.id)} · v{report.version} ·{' '}
            {report.generated_at
              ? new Date(report.generated_at).toLocaleString('en-GB')
              : 'Generation pending'}
          </p>
        </div>
        <Badge>{report.status}</Badge>
      </div>
      {report.status === 'ready' ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Button
              secondary
              type="button"
              disabled={!!busy}
              onClick={() => {
                void run('pdf');
              }}
            >
              Download report PDF
            </Button>
            <Button
              secondary
              type="button"
              disabled={!!busy}
              onClick={() => {
                void run('zip');
              }}
            >
              {busy === 'zip' ? 'Preparing evidence pack…' : 'Download evidence pack'}
            </Button>
          </div>
          <p className="break-all text-[10px] text-muted">SHA-256 {report.sha256}</p>
        </>
      ) : (
        <>
          <p className="text-xs leading-6 text-muted">
            The completed assessment is saved.{' '}
            {leased
              ? 'Report generation is in progress. An interrupted attempt can be retried after five minutes.'
              : 'Generate or retry the report without changing the saved decision.'}
          </p>
          <Button
            type="button"
            disabled={!!busy || leased}
            onClick={() => {
              void run('generate');
            }}
          >
            {busy === 'generate'
              ? 'Generating report…'
              : report.status === 'failed' || report.status === 'generating'
                ? 'Retry report generation'
                : 'Generate report'}
          </Button>
          {report.last_error && <p className="text-xs text-rose-800">{report.last_error}</p>}
        </>
      )}
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
export function ReviewWorkflow({
  finding,
  onSaved,
  onRevise,
  reviewer = false,
  submitter = false,
}: {
  submitter?: boolean;
  reviewer?: boolean;
  finding: ManualFinding;
  onSaved: () => Promise<void>;
  onRevise?: (id: string) => void;
}) {
  const [data, setData] = useState<WorkflowData | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState('');
  const [requestKind, setRequestKind] = useState('evidence');
  const formRef = useRef<HTMLFormElement>(null);
  const request = useRef(crypto.randomUUID());
  const w = useWorkspace();
  useEffect(() => {
    setAction('');
    setNotice('');
    request.current = crypto.randomUUID();
  }, [finding.id]);
  const load = async () => {
    try {
      setData(await workflowApi.data(finding.id));
      setError('');
    } catch (e) {
      setError(message(e));
    }
  };
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [finding.id, finding.revision, finding.currentReview?.id]);
  const assessments =
    finding.reviews
      ?.filter(
        (review) => review.status === 'completed' && review.cycleNumber === finding.cycleNumber,
      )
      .sort((a, b) => b.assessmentRevision - a.assessmentRevision) || [];
  const latest = assessments[0];
  const current = latest && !latest.stale;
  const followups = data?.followups.filter((f) => f.status === 'open') || [];
  const previousRemediation = data?.followups.find(
    (item) => item.kind === 'remediation' && item.cycle_number === finding.cycleNumber,
  );
  const outstandingRemediation =
    previousRemediation?.status === 'open' ? previousRemediation : undefined;
  const prefill = action === 'return_remediation' ? previousRemediation?.data : undefined;
  const canRequestRemediation =
    ['review_completed', 'changes_requested'].includes(finding.lifecycle) &&
    Boolean(
      outstandingRemediation ||
        (current &&
          ['Not closure ready', 'Implemented but evidence incomplete'].includes(
            latest.recommendation || '',
          )),
    );
  useEffect(() => {
    if (!action) return;
    const frame = requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [action]);
  const approval = data?.approvals.find(
    (a) => a.assessment_id === latest?.id && a.status === 'pending',
  );
  const report = data?.reports.find((r) => r.assessment_id === latest?.id);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<
      string,
      string
    >;
    try {
      if (action === 'return_remediation' && outstandingRemediation)
        await workflowApi.repeatRemediation(
          finding.id,
          finding.revision,
          outstandingRemediation.id,
          fields,
          request.current,
        );
      else
        await workflowApi.action(
          finding.id,
          finding.revision,
          latest?.id || null,
          action,
          fields,
          request.current,
        );
      request.current = crypto.randomUUID();
      setNotice('Workflow action recorded.');
      setAction('');
      await onSaved();
      await w.refresh();
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function choose(value: string) {
    if (value === 'return_remediation')
      setRequestKind(previousRemediation?.data.request_kind || 'evidence');
    request.current = crypto.randomUUID();
    setAction(value);
    setNotice('');
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl font-semibold">Review workflow</h2>
        <Badge>Cycle {finding.cycleNumber}</Badge>
        <Badge>{finding.lifecycle.replaceAll('_', ' ')}</Badge>
      </div>
      {latest && (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold">
            Assessment {short(latest.id)} · revision {latest.assessmentRevision} · Completed
          </h3>
          <p className="text-xs leading-6 text-muted">
            {latest.reviewer} · {new Date(latest.createdAt).toLocaleString('en-GB')} ·{' '}
            {latest.recommendation}
            {latest.stale ? ' · Earlier finding/evidence revision' : ''}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-7">{latest.reviewer_conclusion}</p>
          {latest.rules_assessment && <RulesTrace snapshot={latest.rules_assessment} />}
          {report && <ReportActions key={report.id} report={report} onChanged={load} automatic />}
          {current && finding.lifecycle === 'review_completed' && onRevise && (
            <Button secondary type="button" onClick={() => onRevise(latest.id)}>
              Create assessment revision
            </Button>
          )}
        </div>
      )}
      {!submitter &&
        followups.map((item) => (
          <div key={item.id} className="mt-5 rounded-xl border border-accent/20 bg-soft/40 p-4">
            <h3 className="text-sm font-semibold">
              {item.kind === 'retest' ? 'Retest requested' : 'Remediation requested'}
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
              {item.data.requested_actions}
            </p>
            {item.data.scope_correction && (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-6">
                Scope correction requested: {item.data.scope_correction}
              </p>
            )}
            <p className="mt-2 text-xs leading-6">
              Evidence required: {item.data.evidence_requirements}
              <br />
              Owner / tester: {item.data.owner}
              {item.data.due_date && ` · Due: ${item.data.due_date}`}
            </p>
            <p className="mt-2 text-xs text-muted">
              See the finding’s Evidence section to add records before resubmitting.
            </p>
          </div>
        ))}
      <div className="mt-5 flex flex-wrap gap-3">
        {!submitter && canRequestRemediation && (
          <Button
            type="button"
            disabled={!data || busy}
            onClick={() => choose('return_remediation')}
          >
            {reviewer
              ? 'Request remediation'
              : outstandingRemediation
                ? 'Request remediation again'
                : 'Return for Remediation'}
          </Button>
        )}
        {current && finding.lifecycle === 'review_completed' && (
          <>
            {latest.recommendation === 'Ready for retest' && (
              <Button type="button" onClick={() => choose('request_retest')}>
                Request retest
              </Button>
            )}
            {latest.recommendation === 'Closure ready' && (
              <Button
                type="button"
                disabled={report?.status !== 'ready'}
                onClick={() => choose('submit_approval')}
              >
                Submit for Final Approval
              </Button>
            )}
          </>
        )}
        {!reviewer &&
          !submitter &&
          ['changes_requested', 'retest_pending'].includes(finding.lifecycle) && (
            <Button type="button" onClick={() => choose('resubmit')}>
              Resubmit for Review
            </Button>
          )}
        {approval && finding.lifecycle === 'awaiting_final_approval' && (
          <Button type="button" onClick={() => choose('record_approval')}>
            Record approval decision
          </Button>
        )}
        {finding.lifecycle === 'closed' && (
          <Button secondary type="button" onClick={() => choose('reopen')}>
            Reopen for follow-up
          </Button>
        )}
      </div>
      {outstandingRemediation && !submitter && (
        <p role="status" className="mt-4 text-xs leading-6 text-muted">
          Remediation has already been requested. You can reopen the previous request, edit its
          details and send an additional request. Earlier requests are preserved.
        </p>
      )}
      {action && (
        <form
          key={action + ':' + (prefill ? previousRemediation?.id : '')}
          ref={formRef}
          onSubmit={submit}
          className="mt-6 grid gap-5 rounded-xl border border-line p-5 sm:grid-cols-2"
        >
          <h3 className="text-sm font-semibold sm:col-span-2">
            {
              (
                {
                  return_remediation: reviewer ? 'Request remediation' : 'Return for Remediation',
                  request_retest: 'Request retest',
                  submit_approval: 'Submit for Final Approval',
                  resubmit: 'Resubmit for Review',
                  record_approval: 'Record approval decision',
                  reopen: 'Reopen for follow-up',
                } as Record<string, string>
              )[action]
            }
          </h3>
          <Field label={action === 'record_approval' ? 'Recorded by' : 'Your name'}>
            <input
              name="actor"
              defaultValue={prefill?.actor}
              required
              minLength={2}
              maxLength={200}
            />
          </Field>
          {action === 'return_remediation' && (
            <>
              <Field label="Request type">
                <select
                  name="request_kind"
                  value={requestKind}
                  onChange={(event) => setRequestKind(event.target.value)}
                >
                  <option value="evidence">More evidence</option>
                  <option value="scope">Scope correction</option>
                  <option value="scope_and_evidence">Scope correction and more evidence</option>
                </select>
              </Field>
              {requestKind !== 'evidence' && (
                <div className="sm:col-span-2">
                  <Field label="Requested scope correction">
                    <textarea
                      name="scope_correction"
                      defaultValue={prefill?.scope_correction}
                      required
                      minLength={10}
                      maxLength={5000}
                      rows={3}
                    />
                  </Field>
                </div>
              )}
            </>
          )}
          {['resubmit', 'reopen'].includes(action) && (
            <div className="sm:col-span-2">
              <Field label="Changes and response to requests">
                <textarea name="change_summary" required minLength={10} maxLength={5000} rows={4} />
              </Field>
            </div>
          )}
          {['return_remediation', 'request_retest', 'record_approval'].includes(action) && (
            <>
              <Field label="Action owner / retest contact">
                <input
                  name="owner"
                  defaultValue={prefill?.owner}
                  minLength={2}
                  maxLength={200}
                  required={action !== 'record_approval'}
                />
              </Field>
              <Field label="Requested date (optional)">
                <input name="due_date" defaultValue={prefill?.due_date} type="date" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Requested actions / retest scope">
                  <textarea
                    name="requested_actions"
                    defaultValue={prefill?.requested_actions}
                    minLength={10}
                    maxLength={5000}
                    required={action !== 'record_approval'}
                    rows={3}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Evidence required">
                  <textarea
                    name="evidence_requirements"
                    defaultValue={prefill?.evidence_requirements}
                    minLength={10}
                    maxLength={5000}
                    required={action !== 'record_approval'}
                    rows={3}
                  />
                </Field>
              </div>
            </>
          )}
          {action === 'record_approval' && (
            <>
              <Field label="Approval decision">
                <select name="decision">
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </Field>
              <Field label="Decision-maker name">
                <input name="decision_maker" required minLength={2} maxLength={1000} />
              </Field>
              <Field label="Decision-maker organisation">
                <input name="organisation" required minLength={2} maxLength={1000} />
              </Field>
              <Field label="Decision-maker capacity">
                <select name="capacity">
                  <option>External auditor</option>
                  <option>Designated management approver</option>
                </select>
              </Field>
              <Field label="Decision date">
                <input name="decision_date" type="date" required />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Decision reason">
                  <textarea name="reason" required minLength={10} maxLength={5000} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Supporting decision reference / document link">
                  <input name="decision_reference" required minLength={2} maxLength={1000} />
                </Field>
              </div>
              <p className="text-xs leading-6 text-muted sm:col-span-2">
                ClosureProof supplies the closure-readiness recommendation, not formal approval.
                Record the external auditor or management decision-maker separately from the person
                entering their decision. For a rejection, complete the action owner, requested
                actions and evidence requirements above.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <Button disabled={busy}>{busy ? 'Saving…' : 'Confirm action'}</Button>
            <Button secondary type="button" disabled={busy} onClick={() => setAction('')}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {data?.decisions.map((decision) => (
        <div key={decision.id} className="mt-5 border-t border-line pt-4 text-xs leading-6">
          <h3 className="font-semibold">Approval {decision.decision}</h3>
          <p>
            Decision-maker: {decision.data.decision_maker} · {decision.data.capacity} ·{' '}
            {decision.data.organisation}
            <br />
            Decision date: {decision.data.decision_date}
            <br />
            Recorded by: {decision.data.actor} ·{' '}
            {new Date(decision.created_at).toLocaleString('en-GB')}
          </p>
          <p className="whitespace-pre-wrap">{decision.data.reason}</p>
          <p>Supporting reference: {decision.data.decision_reference}</p>
        </div>
      ))}
      {data && data.cycles.length > 0 && (
        <details className="mt-6 border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Submission cycles and comparison
          </summary>
          {data.cycles.map((cycle) => (
            <div key={cycle.id} className="mt-4 text-xs leading-6">
              <strong>
                Cycle {cycle.number} · submitted by {cycle.submitted_by}
              </strong>
              <p>{cycle.change_summary}</p>
              <p>
                {new Date(cycle.created_at).toLocaleString('en-GB')} · finding revision{' '}
                {cycle.submission_revision}
              </p>
            </div>
          ))}
          {finding.reviews
            ?.filter((review) => review.status === 'completed')
            .map((review) => (
              <div
                key={review.id}
                className="mt-5 rounded-lg border border-line p-4 text-xs leading-6"
              >
                <strong>
                  Cycle {review.cycleNumber} · assessment revision {review.assessmentRevision} ·{' '}
                  {review.recommendation}
                </strong>
                <p>{review.reviewer_conclusion}</p>
                <p>Scope: {review.finding_snapshot.resources}</p>
                <p>Required follow-up: {review.clarification_request || 'None recorded'}</p>
                <p>
                  Evidence:{' '}
                  {review.evidence_snapshot
                    .map((file) => `${file.filename} v${file.version}`)
                    .join(', ') || 'None supplied'}
                </p>
                <p>
                  Implementation:{' '}
                  {review.checks
                    .map(
                      (check) =>
                        `${check.check_id}: ${check.implementation_status || check.result}`,
                    )
                    .join('; ')}
                </p>
                {review.supersedesId && <p>Corrects assessment: {review.supersedesId}</p>}
                {data.reports
                  .filter((r) => r.assessment_id === review.id && r.id !== report?.id)
                  .map((r) => (
                    <ReportActions key={r.id} report={r} onChanged={load} />
                  ))}
              </div>
            ))}
        </details>
      )}
      {notice && (
        <div className="mt-4">
          <Notice>{notice}</Notice>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <Notice error>{error}</Notice>
        </div>
      )}
    </Card>
  );
}
export function CompletedReportsPage() {
  const { manualFindings } = useWorkspace();
  const [data, setData] = useState<WorkflowData | null>(null);
  const [error, setError] = useState('');
  const load = async () => {
    try {
      setData(await workflowApi.data());
      setError('');
    } catch (e) {
      setError(message(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <PageHeader
        title="Closure packs"
        description="Assessment reports and evidence packs generated from completed review snapshots."
      />
      {error && <Notice error>{error}</Notice>}
      {data && !data.reports.length && (
        <Card>
          <p className="text-sm leading-7 text-muted">
            Complete a review to create its assessment report. Every completed outcome appears here,
            including cases needing more evidence.
          </p>
        </Card>
      )}
      <div className="space-y-5">
        {data?.reports.map((report) => (
          <Card key={report.id}>
            <Link
              className="mb-4 inline-block text-xs font-semibold text-accent"
              to={'/app/findings/' + report.finding_id}
            >
              {manualFindings.find((f) => f.id === report.finding_id)?.title ||
                'Finding ' + short(report.finding_id)}{' '}
              · assessment {short(report.assessment_id)} →
            </Link>
            <p className="mb-4 text-xs leading-6 text-muted">
              {(() => {
                const review = manualFindings
                  .find((f) => f.id === report.finding_id)
                  ?.reviews?.find((r) => r.id === report.assessment_id);
                return review
                  ? `${review.reviewer} · ${review.recommendation} · Completed ${new Date(review.createdAt).toLocaleString('en-GB')}`
                  : 'Completed assessment';
              })()}
            </p>
            <ReportActions report={report} onChanged={load} />
          </Card>
        ))}
      </div>
    </>
  );
}
