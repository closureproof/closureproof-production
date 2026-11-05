import type { Finding, Organisation, Member, AuditEvent } from './types';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}/api/v1${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers, Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof body.detail === 'string' ? body.detail : `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const api = {
  organisations: (token: string) => request<Organisation[]>('/organisations', token),
  findings: (org: string, token: string) => request<Finding[]>(`/organisations/${encodeURIComponent(org)}/findings`, token),
  createFinding: (org: string, token: string, finding: Omit<Finding, 'id' | 'checks' | 'state' | 'revision' | 'actions' | 'evidence'>) => request<Finding>(`/organisations/${encodeURIComponent(org)}/findings`, token, { method: 'POST', body: JSON.stringify(finding) }),
  members: (org: string, token: string) => request<Member[]>(`/organisations/${encodeURIComponent(org)}/members`, token),
  events: (org: string, token: string) => request<AuditEvent[]>(`/organisations/${encodeURIComponent(org)}/audit-events`, token),
};
