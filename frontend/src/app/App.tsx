import { Component, useEffect, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { WorkspaceProvider } from './WorkspaceProvider';
import { WorkspaceLayout } from '../components/WorkspaceLayout';
import { LandingPage } from '../pages/LandingPage';
import { RequestDemoPage } from '../pages/RequestDemoPage';
import { OverviewPage, ExportsPage, HistoryPage, IntegrationsPage, MembersPage, SettingsPage } from '../pages/WorkspacePages';
import { ManualFindingsPage, ManualFindingCreate, ManualFindingDetail, ManualReviewWorkspace, ManualProtocolsPage, ManualEvidencePage } from '../pages/ManualReviewPages';
import { Empty, Notice, secondaryClass } from '../components/ui';
function WorkspaceAlias() {
  const { pathname, search } = useLocation(); const prefix = ['/dashboard.html', '/preview', '/workbench'].find(p => pathname === p || pathname.startsWith(p + '/'))!;
  const suffix = pathname.slice(prefix.length);
  return <Navigate replace to={'/app' + (suffix.startsWith('/reports') ? '/findings' : suffix) + search} />;
}
function NotFound() { return <Empty title="Page not found" description="This address does not match an available page." action={<Link className={secondaryClass} to="/">Back to home</Link>} />; }
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> { state = { error: false }; static getDerivedStateFromError() { return { error: true }; } render() { return this.state.error ? <main className="mx-auto max-w-xl p-10"><Notice error>This page could not be displayed. Reload and try again.</Notice><a href="/" className={secondaryClass}>Return home</a></main> : this.props.children; } }
function RouteEffects() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); document.title = pathname === '/' ? 'ClosureProof — Close findings with confidence' : 'ClosureProof — ' + (pathname === '/request-demo' ? 'Request demo' : 'Evidence workspace'); }, [pathname]); return null; }
export function App() {
 return <ErrorBoundary><a href="#main" className="sr-only z-50 rounded-xl bg-white p-3 focus:not-sr-only focus:fixed">Skip to content</a><RouteEffects /><Routes><Route path="/" element={<LandingPage />} /><Route path="/request-demo" element={<RequestDemoPage />} /><Route path="/login" element={<Navigate replace to="/app" />} />{['/signup', '/reset-password', '/update-password'].map(path => <Route key={path} path={path} element={<Navigate replace to="/app" />} />)}{['/dashboard.html/*', '/preview/*', '/workbench/*'].map(path => <Route key={path} path={path} element={<WorkspaceAlias />} />)}<Route path="/app" element={<WorkspaceProvider><WorkspaceLayout /></WorkspaceProvider>}><Route index element={<OverviewPage />} /><Route path="findings" element={<ManualFindingsPage />} /><Route path="findings/new" element={<ManualFindingCreate />} /><Route path="submission" element={<ManualFindingCreate />} /><Route path="findings/:id" element={<ManualFindingDetail />} /><Route path="findings/:id/edit" element={<ManualFindingDetail editing />} /><Route path="reviews" element={<ManualFindingsPage queue />} /><Route path="review-queue" element={<Navigate replace to="/app/reviews" />} /><Route path="reviews/:id" element={<ManualReviewWorkspace />} /><Route path="evidence" element={<ManualEvidencePage />} /><Route path="protocols" element={<ManualProtocolsPage />} /><Route path="history" element={<HistoryPage />} /><Route path="exports" element={<ExportsPage />} /><Route path="integrations" element={<IntegrationsPage />} /><Route path="members" element={<MembersPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="*" element={<NotFound />} /></Route><Route path="*" element={<NotFound />} /></Routes></ErrorBoundary>;
}
