import { Link, useSearchParams } from '../lib/navigation';
import { ArrowRight, Plus } from 'lucide-react';
import { useWorkspace } from '../app/WorkspaceProvider';
import {
  Badge,
  Card,
  Empty,
  Field,
  Notice,
  PageHeader,
  StateBadge,
  buttonClass,
} from '../components/ui';
import { providerGroups } from '../features/providers';
import { ProviderLogo } from '../components/ProviderLogo';
import { type ManualFinding } from '../lib/manual-api';

export function OverviewPage() {
  const { manualFindings: findings, events, loading, error } = useWorkspace();
  const hasGaps = (f: ManualFinding) =>
    ['Not closure ready', 'Implemented but evidence incomplete'].includes(f.readiness || '');
  const stats = [
    {
      label: 'Findings submitted',
      count: findings.length,
      note: `${findings.filter((f) => !f.readiness).length} awaiting a reviewer recommendation`,
      filter: '',
    },
    {
      label: 'Evidence gaps',
      count: findings.filter(hasGaps).length,
      note: 'Recorded by the reviewer',
      filter: 'gaps',
    },
    {
      label: 'Ready for retest',
      count: findings.filter((f) => f.readiness === 'Ready for retest').length,
      note: 'Reviewer recommendation',
      filter: 'Ready for retest',
    },
    {
      label: 'Closure ready',
      count: findings.filter((f) => f.readiness === 'Closure ready').length,
      note: 'Current reviewed revisions',
      filter: 'Closure ready',
    },
  ];
  const featured = findings.find(hasGaps) || findings[0];
  const featuredTitle = !featured
    ? 'Start with a finding'
    : hasGaps(featured)
      ? 'Evidence needs attention'
      : featured.readiness === 'Closure ready'
        ? 'Evidence supports closure readiness'
        : featured.readiness === 'Ready for retest'
          ? 'Ready for independent retest'
          : 'Awaiting evidence review';
  const canSubmit = true;
  return (
    <>
      <PageHeader
        eyebrow="Your assurance workspace"
        title="Closure overview"
        description="A clear view of corrective actions, evidence gaps and review. All records come from your workspace."
        action={
          canSubmit && (
            <Link className={buttonClass} to="/app/submission">
              <Plus size={16} />
              Submit a finding
            </Link>
          )
        }
      />
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={'/app/findings' + (s.filter ? '?readiness=' + encodeURIComponent(s.filter) : '')}
            className="rounded-2xl border border-line bg-white p-5 transition hover:border-accent/40"
          >
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-3 font-display text-4xl font-bold tracking-tight">
              {loading || error ? '—' : s.count}
            </p>
            <p className="mt-3 text-[11px] text-muted">{s.note}</p>
          </Link>
        ))}
      </div>
      {findings.some((f) =>
        ['changes_requested', 'retest_pending', 'awaiting_final_approval'].includes(f.lifecycle),
      ) && (
        <Card className="mb-7">
          <h2 className="font-display font-semibold">Action required</h2>
          <div className="mt-3 divide-y divide-line">
            {findings
              .filter((f) =>
                ['changes_requested', 'retest_pending', 'awaiting_final_approval'].includes(
                  f.lifecycle,
                ),
              )
              .map((f) => (
                <Link
                  key={f.id}
                  to={'/app/findings/' + f.id}
                  className="flex flex-wrap justify-between gap-3 py-3 text-xs leading-6"
                >
                  <span className="font-semibold">{f.title}</span>
                  <span className="text-accent">
                    {f.lifecycle === 'changes_requested'
                      ? 'Remediation and resubmission requested'
                      : f.lifecycle === 'retest_pending'
                        ? 'Retest requested'
                        : 'Final approval requested'}{' '}
                    →
                  </span>
                </Link>
              ))}
          </div>
        </Card>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display font-semibold">Finding register</h2>
            <Link to="/app/findings" className="text-xs font-semibold text-accent">
              View all →
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-muted">Loading saved findings…</p>
          ) : error ? (
            <p className="text-sm text-muted">
              Findings are unavailable. Retry the connection above.
            </p>
          ) : (
            <FindingsTable findings={findings.slice(0, 8)} />
          )}
        </Card>
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl bg-charcoal p-6 text-white">
            <span className="rounded-md bg-white/10 px-2 py-1 text-[11px]">
              Evidence before closure
            </span>
            <h2 className="mt-5 font-display text-2xl leading-tight font-semibold">
              {featuredTitle}
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/70">
              {featured
                ? `${featured.title}. ${featured.readiness ? `Reviewer recommendation: ${featured.readiness}.` : 'Awaiting review; no readiness recommendation has been published.'}`
                : 'Submit a finding and attach evidence. A reviewer records the checks, evidence gaps and recommendation.'}
            </p>
            <Link
              to={featured ? '/app/findings/' + featured.id : '/app/findings'}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highlight"
            >
              {featured ? 'Inspect the evidence' : 'Open findings'}
              <ArrowRight size={16} />
            </Link>
          </section>
          <Card>
            <h2 className="mb-4 font-display text-sm font-semibold">Recent activity</h2>
            {!events.length && (
              <p className="text-xs leading-6 text-muted">
                Your submissions, uploads and reviews will appear here.
              </p>
            )}
            {events.slice(0, 3).map((e) => (
              <div key={e.id} className="border-t border-line py-3">
                <p className="text-xs font-medium">{e.title}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {e.actor} · {new Date(e.timestamp).toLocaleString('en-GB')}
                </p>
              </div>
            ))}
            <Link className="text-xs font-semibold text-accent" to="/app/history">
              View decision history →
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}

export function FindingsTable({ findings }: { findings: ManualFinding[] }) {
  if (!findings.length)
    return (
      <Empty
        title="No findings submitted"
        description="Your saved findings will appear here. No sample records are displayed."
      />
    );
  return (
    <table aria-label="Finding register" className="block w-full table-fixed sm:table">
      <thead className="hidden sm:table-header-group">
        <tr>
          <th scope="col" className="pl-0">
            Reference / Finding
          </th>
          <th scope="col" className="w-24 px-2">
            Priority
          </th>
          <th scope="col" className="w-48 pr-0">
            Review status
          </th>
        </tr>
      </thead>
      <tbody className="block sm:table-row-group">
        {findings.map((f) => (
          <tr
            key={f.id}
            className="group grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 border-b border-line transition-colors hover:bg-soft/50 sm:table-row"
          >
            <td className="col-span-2 min-w-0 border-0 px-0 pb-2 pt-4 align-top sm:py-4 sm:pr-4">
              <p className="mb-2 break-words text-[11px] font-medium text-accent">
                {f.findingReference || f.id.slice(0, 8).toUpperCase()}
              </p>
              <Link
                to={'/app/findings/' + f.id}
                className="block break-words text-sm font-medium leading-6 transition-colors hover:text-accent focus-visible:text-accent"
              >
                {f.title}
              </Link>
              <p className="mt-1 break-words text-xs leading-5 text-muted">
                {f.owner || 'Owner not recorded'}
              </p>
            </td>
            <td className="min-w-0 border-0 px-0 pb-4 pt-2 align-top sm:px-2 sm:py-4">
              <span className="mb-2 block text-[11px] text-muted sm:hidden">Priority</span>
              <Badge
                tone={f.severity === 'High' ? 'red' : f.severity === 'Medium' ? 'amber' : 'neutral'}
              >
                {f.severity}
              </Badge>
            </td>
            <td className="min-w-0 border-0 px-0 pb-4 pt-2 align-top sm:py-4 sm:pl-4">
              <span className="mb-2 block text-[11px] text-muted sm:hidden">Review status</span>
              {f.readiness ? <StateBadge state={f.readiness} /> : <Badge>Awaiting review</Badge>}
              <p className="mt-2 break-words text-xs leading-5 text-muted">
                {f.lifecycle === 'changes_requested'
                  ? 'Remediation requested'
                  : f.lifecycle.replaceAll('_', ' ')}
              </p>
              <p className="mt-1 text-[11px] text-muted">Revision {f.revision}</p>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function HistoryPage() {
  const { events, loading, error } = useWorkspace();
  return (
    <>
      <PageHeader
        title="Decision history"
        description="Submissions, evidence access requests, reviews and revision changes."
      />
      <Card>
        {loading ? (
          <p>Loading history…</p>
        ) : error ? (
          <p>History is unavailable until the connection is restored.</p>
        ) : events.length ? (
          events.map((e) => (
            <div className="border-t border-line py-4" key={e.id}>
              <h2 className="text-sm font-semibold">{e.title}</h2>
              <p className="mt-2 text-xs leading-6 text-muted">{e.detail}</p>
              <p className="mt-2 text-[10px] text-muted">
                {e.actor} · {new Date(e.timestamp).toLocaleString('en-GB')} · Revision {e.revision}
              </p>
            </div>
          ))
        ) : (
          <Empty title="No history yet" description="Saved workspace activity will appear here." />
        )}
      </Card>
    </>
  );
}
export function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Manual evidence today. Authorised provider collection is planned for a future release."
      />
      <Notice>
        No live connections, agents or infrastructure changes are available in this release.
      </Notice>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {providerGroups.map(({ name, brands, description }) => (
          <Card key={name}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {brands.map((brand) => (
                  <ProviderLogo key={brand} name={brand} />
                ))}
              </div>
              <Badge>Planned integration</Badge>
            </div>
            <h2 className="mt-6 font-bold">{name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
export { CompletedReportsPage as ExportsPage } from '../components/ReviewWorkflow';
export function MembersPage() {
  return (
    <>
      <PageHeader title="Members" description="Submission and review collaboration." />
      <Card>
        <p className="text-sm leading-7 text-muted">
          Submit findings and supporting evidence, then record review observations and closure
          recommendations.
        </p>
      </Card>
    </>
  );
}
export function SettingsPage() {
  const w = useWorkspace();
  const org = w.organisations.find((o) => o.id === w.orgId);
  return (
    <>
      <PageHeader
        title="Organisation settings"
        description="Workspace identity and evidence storage."
      />
      <Card className="max-w-3xl">
        <div className="grid gap-5">
          <Field label="Organisation name">
            <input readOnly value={org?.name || ''} />
          </Field>
          <Field label="Workspace access">
            <input readOnly value="Shared workspace" />
          </Field>
          <Field label="Evidence storage">
            <input readOnly value="Shared evidence storage" />
          </Field>
          <Field label="Upload limit">
            <input readOnly value="25 MB per file · 30 files / 250 MB per finding" />
          </Field>
          <Notice>
            Reviewer recommendations and evidence history are recorded against each finding.
          </Notice>
        </div>
      </Card>
    </>
  );
}
