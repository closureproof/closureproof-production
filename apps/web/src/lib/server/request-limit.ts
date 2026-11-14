import 'server-only';
import {createHmac} from 'node:crypto';
import {demoAdmin} from './demo-requests';
import {RequestBodyError} from './request-body';
export type LimitedAction = 'demo' | 'analysis-read' | 'analysis-write' | 'analysis-confirm' | 'assessment' | 'upload';
export async function limitRequest(request: Request, action: LimitedAction) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new RequestBodyError('Service temporarily unavailable.', 503);
  // Only Vercel's overwritten client-IP header is trusted. Else use a shared
  // bucket, rather than trusting an attacker-supplied X-Forwarded-For value.
  const identity = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'shared' : 'shared';
  const subject = createHmac('sha256', secret).update(identity).digest('hex');
  const {data, error} = await demoAdmin().rpc('cpp_request_limit', {p_action: action, p_subject: subject});
  if (error) throw new RequestBodyError('Service temporarily unavailable. Please try again later.', 503);
  if (data !== true) throw new RequestBodyError('Too many requests. Please try again later.', 429);
}
