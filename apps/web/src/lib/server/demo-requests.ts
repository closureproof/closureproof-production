import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
export class DemoRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const optionalEmail = z.union([z.literal(''), z.string().trim().email().max(254)]).default('');
export const demoRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254),
    companyName: z.string().trim().min(1).max(180),
    contactPerson: z.string().trim().min(1).max(120),
    contactEmail: optionalEmail,
    contactPhone: z.string().trim().max(40).default(''),
  })
  .strict();
export function demoAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new DemoRequestError(
      'Demo requests are temporarily unavailable. Your details have not been sent. Please try again later.',
      503,
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
function dbFailure(error: { code?: string } | null) {
  if (error)
    throw new DemoRequestError(
      error.code === '22023'
        ? 'This request was already submitted with different details. Reload the form before sending a new enquiry.'
        : 'We could not save your request. Your details have not been confirmed as received. Please try again.',
      error.code === '22023' ? 409 : 503,
    );
}
interface Lead {
  id: string;
  name: string;
  email: string;
  company_name: string;
  contact_person: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}
export async function notifyDemoAdmin(
  id: string,
  admin = demoAdmin(),
  fetcher: typeof fetch = fetch,
) {
  const key = process.env.RESEND_API_KEY,
    from = process.env.DEMO_NOTIFICATION_FROM,
    to = process.env.DEMO_ADMIN_EMAIL;
  if (!key || !from || !to) return 'pending';
  if (!z.string().email().safeParse(to).success || /[\r\n]/.test(from)) return 'pending';
  const lease = randomUUID();
  const claim = await admin.rpc('demo_claim_notification', { p_id: id, p_lease: lease });
  if (claim.error) return 'pending';
  if (!claim.data) return 'unchanged';
  const lead = claim.data as Lead;
  let message: string | null = null;
  let error: string | null = null;
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'demo-request/' + id,
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: lead.email,
        subject: 'New ClosureProof demo request',
        text: [
          `A new demo enquiry has been saved.`,
          `Request ID: ${lead.id}`,
          `Received: ${lead.created_at}`,
          `Name: ${lead.name}`,
          `Email: ${lead.email}`,
          `Company: ${lead.company_name}`,
          `Contact person: ${lead.contact_person}`,
          `Contact email: ${lead.contact_email || 'Not supplied'}`,
          `Contact phone: ${lead.contact_phone || 'Not supplied'}`,
        ].join('\n'),
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || typeof body?.id !== 'string')
      throw Error('Provider did not accept the notification');
    message = body.id;
  } catch {
    error = 'Email delivery was not confirmed. Retry the notification; the enquiry remains saved.';
  }
  const finished = await admin.rpc('demo_finish_notification', {
    p_id: id,
    p_lease: lease,
    p_message: message,
    p_error: error,
  });
  return finished.error ? 'pending' : message ? 'sent' : 'failed';
}
export async function saveDemoRequest(
  raw: unknown,
  admin = demoAdmin(),
  fetcher: typeof fetch = fetch,
) {
  const { requestId, ...data } = demoRequestSchema.parse(raw);
  const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const result = await admin.rpc('demo_save_request', {
    p_id: requestId,
    p_fingerprint: fingerprint,
    p_data: data,
  });
  dbFailure(result.error);
  try {
    await notifyDemoAdmin(result.data as string, admin, fetcher);
  } catch {
    /* Delivery failure never loses an accepted enquiry. */
  }
  return { accepted: true };
}
export async function retryDemoNotifications(admin = demoAdmin(), fetcher: typeof fetch = fetch) {
  const result = await admin
    .from('demo_requests')
    .select('id')
    .in('notification_status', ['pending', 'failed', 'sending'])
    .lt('notification_attempts', 5)
    .order('created_at')
    .limit(10);
  dbFailure(result.error);
  const statuses = [];
  for (const row of result.data || []) statuses.push(await notifyDemoAdmin(row.id, admin, fetcher));
  return { processed: statuses.length, statuses };
}
