'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { getSupabase } from '../lib/supabase';
import type { ManualFinding } from '../lib/manual-api';
import { Button, Card, Field, Notice } from './ui';
interface RequestRecord {
  id: string;
  kind: 'scope' | 'evidence';
  status: 'open' | 'responded' | 'resolved';
  requested_by: string;
  reason: string;
  requested_change: string;
  finding_revision: number;
  created_at: string;
  response_by?: string;
  response?: string;
  resolved_by?: string;
  resolution?: string;
}
const migration =
  'Install 20261112000100_review_requests.sql in Supabase to enable recorded review requests.';
export function ReviewRequests({
  finding,
  reviewer = false,
}: {
  finding: ManualFinding;
  reviewer?: boolean;
}) {
  const [rows, setRows] = useState<RequestRecord[]>([]);
  const [action, setAction] = useState<{ id: string; type: 'respond' | 'resolve' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const locked = ['closed', 'awaiting_final_approval'].includes(finding.lifecycle);
  async function load() {
    const { data, error } = await getSupabase()
      .from('cpp_review_requests')
      .select('*')
      .eq('finding_id', finding.id)
      .order('created_at', { ascending: false });
    if (error) throw Error(['PGRST205', '42P01'].includes(error.code) ? migration : error.message);
    setRows(data || []);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [finding.id, finding.revision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await getSupabase().rpc('cpp_review_request', {
        p_finding: finding.id,
        p_revision: finding.revision,
        p_request: action.id,
        p_action: action.type,
        p_data: data,
      });
      if (result.error)
        throw Error(
          ['PGRST202', '42883'].includes(result.error.code) ? migration : result.error.message,
        );
      setAction(null);
      setNotice(
        action.type === 'respond'
          ? 'Response recorded for reviewer verification.'
          : 'Request resolved. This does not complete the review or close the finding.',
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  if (!rows.length && !error) return null;
  return (
    <Card>
      <h2 className="font-display text-xl font-semibold">Previous review requests</h2>
      <p className="mt-2 text-xs leading-6 text-muted">
        {reviewer
          ? 'Existing requests and submitter responses are preserved here. Use Request remediation to request more evidence or a scope correction.'
          : 'Respond to reviewer requests here. Apply scope corrections and upload evidence on this finding before describing your response; the reviewer verifies the result.'}
      </p>
      {error && <Notice error>{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}

      {action && (
        <form
          key={action.id + action.type}
          onSubmit={submit}
          className="mt-5 space-y-4 rounded-xl border border-line p-4"
        >
          <h3 className="text-sm font-semibold">
            {action.type === 'respond' ? 'Respond to request' : 'Verify and resolve request'}
          </h3>
          <fieldset disabled={busy} className="space-y-4">
            <Field label="Request recorded by">
              <input name="actor" required minLength={2} maxLength={200} />
            </Field>
            <Field
              label={
                action.type === 'respond'
                  ? 'Response and supporting references'
                  : 'Verification and resolution notes'
              }
            >
              <textarea
                name={action.type === 'respond' ? 'response' : 'resolution'}
                required
                minLength={10}
                maxLength={5000}
              />
            </Field>
            <div className="flex gap-3">
              <Button type="submit">
                {busy ? 'Saving…' : action.type === 'respond' ? 'Send response' : 'Resolve request'}
              </Button>
              <Button secondary type="button" onClick={() => setAction(null)}>
                Cancel
              </Button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="space-y-2 rounded-xl border border-line p-4 text-xs leading-6"
          >
            <p className="font-semibold">
              {row.kind === 'scope' ? 'Scope correction' : 'Additional evidence'} ·{' '}
              {row.status === 'responded' ? 'Awaiting reviewer verification' : row.status}
            </p>
            <p>
              Requested by {row.requested_by} · revision {row.finding_revision} ·{' '}
              {new Date(row.created_at).toLocaleString('en-GB')}
            </p>
            <p className="whitespace-pre-wrap">Reason: {row.reason}</p>
            <p className="whitespace-pre-wrap">Requested: {row.requested_change}</p>
            {row.response && (
              <p className="whitespace-pre-wrap">
                Response by {row.response_by}: {row.response}
              </p>
            )}
            {row.resolution && (
              <p className="whitespace-pre-wrap">
                Verified by {row.resolved_by}: {row.resolution}
              </p>
            )}
            {!locked && !reviewer && row.status === 'open' && (
              <Button
                secondary
                size="compact"
                type="button"
                onClick={() => setAction({ id: row.id, type: 'respond' })}
              >
                Respond to request
              </Button>
            )}
            {!locked && reviewer && row.status === 'responded' && (
              <Button
                secondary
                size="compact"
                type="button"
                onClick={() => setAction({ id: row.id, type: 'resolve' })}
              >
                Verify response
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
