import { Link, useSearchParams } from 'react-router';
import { ArrowRight, Plus, FileArchive } from 'lucide-react';
import { useWorkspace } from '../app/WorkspaceProvider';
import { Badge, Card, Empty, Field, Notice, PageHeader, StateBadge, buttonClass } from '../components/ui';
import { providerGroups } from '../features/providers';
import { ProviderLogo } from '../components/ProviderLogo';
import { type ManualFinding } from '../lib/manual-api';

export function OverviewPage() {
  const { manualFindings: findings, events, loading, error } = useWorkspace();
  const hasGaps = (f: ManualFinding) => ['Not closure ready', 'Implemented but evidence incomplete'].includes(f.readiness || '');
  const stats = [
    { label: 'Findings submitted', count: findings.length, note: `${findings.filter(f => !f.readiness).length} awaiting a reviewer recommendation`, filter: '' },
    { label: 'Evidence gaps', count: findings.filter(hasGaps).length, note: 'Recorded by the reviewer', filter: 'gaps' },
    { label: 'Ready for retest', count: findings.filter(f => f.readiness === 'Ready for retest').length, note: 'Reviewer recommendation', filter: 'Ready for retest' },
    { label: 'Closure ready', count: findings.filter(f => f.readiness === 'Closure ready').length, note: 'Current reviewed revisions', filter: 'Closure ready' },
  ];
  const featured = findings.find(hasGaps) || findings[0];
  const canSubmit = true;
  return <><PageHeader eyebrow="Your assurance workspace" title="Closure overview" description="A clear view of corrective actions, evidence gaps and review. All records come from your workspace." action={canSubmit && <Link className={buttonClass} to="/app/submission"><Plus size={16} />Submit a finding</Link>} />
    <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(s => <Link key={s.label} to={'/app/findings' + (s.filter ? '?readiness=' + encodeURIComponent(s.filter) : '')} className="rounded-2xl border border-line bg-white p-5 transition hover:border-accent/40"><p className="text-xs text-muted">{s.label}</p><p className="mt-3 font-display text-4xl font-bold tracking-tight">{loading || error ? '—' : s.count}</p><p className="mt-3 text-[11px] text-muted">{s.note}</p></Link>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]"><Card><div className="mb-5 flex items-center justify-between"><h2 className="font-display font-semibold">Finding register</h2><Link to="/app/findings" className="text-xs font-semibold text-accent">View all →</Link></div>{loading ? <p className="text-sm text-muted">Loading saved findings…</p> : error ? <p className="text-sm text-muted">Findings are unavailable. Retry the connection above.</p> : <FindingsTable findings={findings.slice(0, 8)} />}</Card>
    <div className="space-y-5"><section className="rounded-2xl bg-charcoal p-6 text-white"><span className="rounded-md bg-white/10 px-2 py-1 text-[11px]">Evidence before closure</span><h2 className="mt-5 font-display text-2xl leading-tight font-semibold">Task complete.<br />Evidence incomplete.</h2><p className="mt-4 text-sm leading-6 text-white/70">{featured ? `${featured.title}. ${featured.readiness ? `Reviewer recommendation: ${featured.readiness}.` : 'Awaiting review; no readiness recommendation has been published.'}` : 'Submit a finding and attach evidence. A reviewer records the checks, evidence gaps and recommendation.'}</p><Link to={featured ? '/app/findings/' + featured.id : '/app/findings'} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highlight">{featured ? 'Inspect the evidence' : 'Open findings'}<ArrowRight size={16} /></Link></section>
    <Card><h2 className="mb-4 font-display text-sm font-semibold">Recent activity</h2>{!events.length && <p className="text-xs leading-6 text-muted">Your submissions, uploads and reviews will appear here.</p>}{events.slice(0, 3).map(e => <div key={e.id} className="border-t border-line py-3"><p className="text-xs font-medium">{e.title}</p><p className="mt-1 text-[11px] text-muted">{e.actor} · {new Date(e.timestamp).toLocaleString('en-GB')}</p></div>)}<Link className="text-xs font-semibold text-accent" to="/app/history">View decision history →</Link></Card></div></div></>;
}

export function FindingsTable({ findings }: { findings: ManualFinding[] }) {
  return findings.length ? <div className="overflow-x-auto"><table className="w-full"><thead><tr><th>Reference / Finding</th><th>Priority</th><th>Evidence basis</th></tr></thead><tbody>{findings.map(f => <tr key={f.id} className="group transition-colors hover:bg-soft/50"><td className="min-w-40"><p className="mb-2 font-mono text-[10px] text-accent">{f.id.slice(0, 8).toUpperCase()}</p><Link to={'/app/findings/' + f.id} className="text-xs leading-6 font-medium transition-colors group-hover:text-accent">{f.title}</Link><p className="mt-1 text-[10px] text-muted">{f.owner || 'Owner not recorded'}</p></td><td><Badge tone={f.severity === 'High' ? 'red' : 'amber'}>{f.severity}</Badge></td><td>{f.readiness ? <StateBadge state={f.readiness} /> : <Badge>Awaiting review</Badge>}<p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted">Revision / {String(f.revision).padStart(2, '0')}</p></td></tr>)}</tbody></table></div> : <Empty title="No findings submitted" description="Your saved findings will appear here. No sample records are displayed." />;
}

export function HistoryPage() {
  const { events, loading, error } = useWorkspace();
  return <><PageHeader title="Decision history" description="Submissions, evidence access requests, reviews and revision changes." /><Card>{loading ? <p>Loading history…</p> : error ? <p>History is unavailable until the connection is restored.</p> : events.length ? events.map(e => <div className="border-t border-line py-4" key={e.id}><h2 className="text-sm font-semibold">{e.title}</h2><p className="mt-2 text-xs leading-6 text-muted">{e.detail}</p><p className="mt-2 text-[10px] text-muted">{e.actor} · {new Date(e.timestamp).toLocaleString('en-GB')} · Revision {e.revision}</p></div>) : <Empty title="No history yet" description="Saved workspace activity will appear here." />}</Card></>;
}
export function IntegrationsPage() {
  return <><PageHeader title="Integrations" description="Manual evidence today. Authorised provider collection is planned for a future release." /><Notice>No live connections, agents or infrastructure changes are available in this release.</Notice><div className="mt-6 grid gap-5 sm:grid-cols-2">{providerGroups.map(({ name, brands, description }) => <Card key={name}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3">{brands.map(brand => <ProviderLogo key={brand} name={brand} />)}</div><Badge>Planned integration</Badge></div><h2 className="mt-6 font-bold">{name}</h2><p className="mt-2 text-sm leading-6 text-muted">{description}</p></Card>)}</div></>;
}
export function ExportsPage() {
  return <><PageHeader title="Closure packs" description="A traceable record of the finding, evidence manifest and review decisions." /><Card><FileArchive size={28} className="text-accent" /><h2 className="mt-5 font-display text-xl font-semibold">Prepare the complete story</h2><p className="mt-3 text-sm leading-7 text-muted">Closure-pack generation is not connected yet. Findings, original files and manual review history are available in their workspace sections.</p><Link to="/app/findings" className={buttonClass + ' mt-5'}>View findings</Link></Card></>;
}
export function MembersPage() {
  return <><PageHeader title="Members" description="Submission and review collaboration." /><Card><p className="text-sm leading-7 text-muted">Submit findings and supporting evidence, then record review observations and closure recommendations.</p></Card></>;
}
export function SettingsPage() {
  const w = useWorkspace(); const org = w.organisations.find(o => o.id === w.orgId);
  return <><PageHeader title="Organisation settings" description="Workspace identity and evidence storage." /><Card className="max-w-3xl"><div className="grid gap-5"><Field label="Organisation name"><input readOnly value={org?.name || ''} /></Field><Field label="Workspace access"><input readOnly value="Shared workspace" /></Field><Field label="Evidence storage"><input readOnly value="Shared evidence storage" /></Field><Field label="Upload limit"><input readOnly value="25 MB per file · 30 files / 250 MB per finding" /></Field><Notice>Reviewer recommendations and evidence history are recorded against each finding.</Notice></div></Card></>;
}
