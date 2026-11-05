import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Finding, Organisation, AuditEvent, Member } from '../lib/types';
import { sampleFindings, sampleEvents } from '../features/sample-data';
interface Workspace { preview: boolean; findings: Finding[]; events: AuditEvent[]; members: Member[]; organisations: Organisation[]; orgId: string; setOrgId: (id: string) => void; loading: boolean; error: string; retry: () => void; savePreview: (finding: Finding) => void }
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { preview: boolean; children: ReactNode }) {
  const [findings, setFindings] = useState<Finding[]>(() => structuredClone(sampleFindings));
  const [events, setEvents] = useState<AuditEvent[]>(sampleEvents);
  const [orgId, setOrgId] = useState('sample');
  const members: Member[] = [{ id: 'm1', name: 'Alex Morgan', email: 'alex@example.test', role: 'Contributor' }, { id: 'm2', name: 'Sam Taylor', email: 'sam@example.test', role: 'Assurance reviewer' }];
  const organisations: Organisation[] = [{ id: 'sample', name: 'Example workspace', role: 'admin' }];
  const savePreview = (finding: Finding) => {
    setFindings(items => items.some(f => f.id === finding.id) ? items.map(f => f.id === finding.id ? finding : f) : [...items, finding]);
    setEvents(items => [{ id: crypto.randomUUID(), findingId: finding.id, title: 'Local preview draft saved', detail: 'No server assessment or approval was performed.', timestamp: new Date().toISOString(), actor: 'Preview user', revision: finding.revision }, ...items]);
  };
  return <Context.Provider value={{ preview: true, findings, events, members, organisations, orgId, setOrgId, loading: false, error: '', retry: () => {}, savePreview }}>{children}</Context.Provider>;
}
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error('Workspace provider is required'); return value; }
