import WorkspaceShell from './WorkspaceShell';
export const metadata = { title: 'Evidence workspace', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return <WorkspaceShell>{children}</WorkspaceShell>; }
