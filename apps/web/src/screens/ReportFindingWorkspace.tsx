'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from '../lib/navigation';
import { documentApi, sourceHref, type PublicAnalysisRun } from '../lib/document-analysis';
import { manualApi, type ManualFinding } from '../lib/manual-api';
import { ManualFindingCreate } from './ManualReviewPages';
import { Button, Card, Loading, Notice, PageHeader, secondaryClass } from '../components/ui';
export function ReportFindingWorkspace() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = useRef(navigate);
  redirect.current = navigate;
  const confirmation = useRef<HTMLHeadingElement>(null);
  const completing = useRef(false);
  const [run, setRun] = useState<PublicAnalysisRun | null>(null);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visited, setVisited] = useState<number[]>([]);
  const [created, setCreated] = useState<Record<number, { id: string; title: string }>>({});
  const selected = Number(params.get('draft'));
  const active =
    params.has('draft') && Number.isInteger(selected) && selected >= 0 ? selected : null;
  useEffect(() => {
    let cancelled = false;
    setRun(null);
    setError('');
    setVisited([]);
    setCreated({});
    setFinished(false);
    if (id)
      documentApi
        .get(id)
        .then((result) => {
          if (cancelled) return;
          if (result.mode !== 'report' || result.status !== 'ready' || !result.result)
            throw Error('This report has no available extracted findings.');
          setRun(result);
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Report unavailable.');
        });
    return () => {
      cancelled = true;
    };
  }, [id]);
  useEffect(() => {
    if (active !== null)
      setVisited((previous) => (previous.includes(active) ? previous : [...previous, active]));
  }, [active, id]);
  useEffect(() => {
    if (!finished) return;
    confirmation.current?.focus();
    const timer = window.setTimeout(() => redirect.current('/app'), 4000);
    return () => window.clearTimeout(timer);
  }, [finished]);
  if (!run) return error ? <Notice error>{error}</Notice> : <Loading />;
  const drafts = run.result!.findings;
  const base = '/app/submission/report/' + run.id;
  const submitted = (index: number) =>
    created[index] ||
    (run.submissions?.find((row) => row.draft_index === index) && {
      id: run.submissions.find((row) => row.draft_index === index)!.finding_id,
      title: drafts[index].fields.title || `Finding ${index + 1}`,
    });
  const count = drafts.filter((_, index) => submitted(index)).length;
  const current = active !== null && active < drafts.length ? active : null;
  const saved = current !== null ? submitted(current) : undefined;
  const first = drafts.findIndex((_, index) => !submitted(index));
  function choose(index: number) {
    setError('');
    setVisited((previous) => (previous.includes(index) ? previous : [...previous, index]));
    navigate(base + '?draft=' + index);
  }
  function saveFinding(index: number, finding: ManualFinding) {
    setCreated((previous) => ({ ...previous, [index]: { id: finding.id, title: finding.title } }));
    const next = drafts.findIndex((_, other) => other !== index && !submitted(other));
    if (next >= 0) choose(next);
    else navigate(base);
  }
  async function completeSubmission() {
    if (completing.current) return;
    completing.current = true;
    setBusy(true);
    setError('');
    try {
      if (!drafts.length || count !== drafts.length)
        throw Error(
          'Save every finding and its supporting evidence before completing this submission.',
        );
      // Re-read persisted records; a saved draft link is not proof that evidence
      // upload succeeded. Completion never creates duplicate findings or reviews.
      const records = await Promise.all(
        drafts.map((_, index) => manualApi.finding(submitted(index)!.id)),
      );
      records.forEach((finding, index) => {
        if (
          finding.source_report?.run_id !== run!.id ||
          finding.source_report.draft_index !== index
        )
          throw Error(
            'A finding no longer matches this report. Reload the submission before continuing.',
          );
        if (!finding.evidence?.length)
          throw Error(
            `Add supporting evidence to “${finding.title}” before completing this submission.`,
          );
      });
      setFinished(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Your submission could not be confirmed. Please try again.',
      );
    } finally {
      completing.current = false;
      setBusy(false);
    }
  }
  if (finished)
    return (
      <Card className="max-w-3xl">
        <div role="status" className="space-y-4 py-4">
          <CheckCircle2 size={32} className="text-accent" aria-hidden="true" />
          <h1
            ref={confirmation}
            tabIndex={-1}
            className="font-display text-3xl font-semibold focus:outline-none"
          >
            Audit submitted
          </h1>
          <p className="text-sm leading-7">
            Thank you. Your audit findings and supporting evidence have been submitted for review.
            Our review team will assess your submission and get back to you with feedback or any
            requests for additional information.
          </p>
          <p className="text-xs text-muted">Returning to Overview in 4 seconds…</p>
          <Link className={secondaryClass} to="/app">
            Go to Overview
          </Link>
        </div>
      </Card>
    );
  return (
    <>
      <PageHeader title="Report findings" description={run.filename} />
      <div className="mb-6 flex flex-wrap items-center gap-4 text-xs leading-6">
        <p>
          {count} of {drafts.length} findings saved
        </p>
        {run.submission_reference && <p>Submission ID: {run.submission_reference}</p>}
        <a
          className="font-semibold text-accent"
          href={sourceHref(run.id)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original audit report
        </a>
      </div>
      {current !== null && (
        <div className="mb-6 space-y-4">
          <Button secondary type="button" onClick={() => navigate(base)}>
            Back to report findings
          </Button>
          <nav aria-label="Findings in this report" className="flex flex-wrap gap-2">
            {drafts.map((_, index) => (
              <Button
                key={index}
                secondary
                type="button"
                aria-current={index === current ? 'step' : undefined}
                onClick={() => choose(index)}
              >
                Finding {index + 1}
                {submitted(index) ? ' · Saved' : ''}
              </Button>
            ))}
          </nav>
          <p className="text-xs text-muted">
            Finding {current + 1} of {drafts.length}. Check its details and add supporting evidence,
            then save to continue. Unsent entries are retained while switching findings here;
            leaving or reloading clears unsent entries.
          </p>
        </div>
      )}
      {current === null && (
        <div className="space-y-4">
          {drafts.map((draft, index) => {
            const record = submitted(index);
            return (
              <Card key={index}>
                <h2 className="font-display text-lg font-semibold">
                  {record?.title || draft.fields.title || `Finding ${index + 1}`}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-6">
                  {draft.fields.description}
                </p>
                {record && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-accent">Saved</span>
                    <Link className={secondaryClass} to={'/app/findings/' + record.id}>
                      Open finding and evidence
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
          {!drafts.length ? (
            <Card>No findings were extracted from this report.</Card>
          ) : first >= 0 ? (
            <Button type="button" onClick={() => choose(first)}>
              Review draft findings
            </Button>
          ) : (
            <Card>
              <h2 className="font-display text-xl font-semibold">
                Ready to complete your submission
              </h2>
              <p className="mt-3 text-sm leading-7">
                All findings have been saved. Complete your submission to confirm the findings and
                supporting evidence are ready for review.
              </p>
              <div className="mt-5">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void completeSubmission();
                  }}
                >
                  {busy ? 'Confirming submission…' : 'Complete submission'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
      {saved && (
        <Card>
          <h2 className="font-display text-xl font-semibold">{saved.title}</h2>
          <p className="mt-3 text-sm leading-6">This finding has already been saved.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {first >= 0 && (
              <Button type="button" onClick={() => choose(first)}>
                Continue with next finding
              </Button>
            )}
            <Link className={secondaryClass} to={'/app/findings/' + saved.id}>
              Open finding and evidence
            </Link>
            <Button type="button" secondary onClick={() => navigate(base)}>
              Review submission
            </Button>
          </div>
        </Card>
      )}
      {error && (
        <div className="my-5">
          <Notice error>{error}</Notice>
        </div>
      )}
      {visited
        .filter((index) => index < drafts.length && !submitted(index))
        .map((index) => (
          <div
            data-report-draft={index}
            key={run.id + ':' + index}
            hidden={current !== index || !!submitted(index)}
          >
            <ManualFindingCreate
              reportDraft={{ id: run.id, index }}
              submitLabel={
                drafts.some((_, other) => other !== index && !submitted(other))
                  ? 'Save and continue'
                  : 'Save finding'
              }
              requireEvidence
              onSubmitted={(finding) => saveFinding(index, finding)}
            />
          </div>
        ))}
    </>
  );
}
