import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { Organisation, AuditEvent, Member } from '../lib/types';
import { manualApi, type ManualFinding } from '../lib/manual-api';
interface Workspace { manualFindings: ManualFinding[]; refresh: () => Promise<void>; events: AuditEvent[]; members: Member[]; organisations: Organisation[]; orgId: string; setOrgId: (id: string) => void; loading: boolean; error: string; retry: () => void; viewerId: string; viewerName: string; role: string }
const Context = createContext<Workspace | null>(null);
const orgId = '00000000-0000-4000-8000-000000000001';
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [manualFindings, setManualFindings] = useState<ManualFinding[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const requestNumber = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++requestNumber.current;
    try {
      const data = await manualApi.workspace(orgId);
      if (request !== requestNumber.current) return;
      setManualFindings(data.findings); setEvents(data.events); setError('');
    } catch (e) {
      if (request !== requestNumber.current) return;
      setError(e instanceof Error ? e.message : 'Could not load workspace records.');
    } finally { if (request === requestNumber.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const update = () => { void refresh(); };
    update(); window.addEventListener('focus', update);
    const timer = window.setInterval(update, 30000);
    return () => { requestNumber.current++; window.removeEventListener('focus', update); window.clearInterval(timer); };
  }, [refresh]);
  return <Context.Provider value={{ manualFindings, refresh, events, members: [], organisations: [{ id: orgId, name: 'ClosureProof', role: 'pilot' }], orgId, setOrgId: () => {}, loading, error, retry: () => { void refresh(); }, viewerId: '00000000-0000-4000-8000-000000000002', viewerName: 'Workspace participant', role: 'pilot' }}>{children}</Context.Provider>;
}
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error('Workspace provider required'); return value; }
