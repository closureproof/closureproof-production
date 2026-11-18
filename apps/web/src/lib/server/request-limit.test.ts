import { expect, it, vi, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./demo-requests', () => ({ demoAdmin: () => ({ rpc }) }));
import { limitRequest } from './request-limit';
afterEach(() => {
  vi.unstubAllEnvs();
  rpc.mockReset();
});
it('hashes client identity and ignores forwarded IP spoofing outside Vercel', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-secret');
  vi.stubEnv('VERCEL', '');
  rpc.mockResolvedValue({ data: true, error: null });
  await limitRequest(
    new Request('https://example.test', { headers: { 'x-forwarded-for': 'fake-ip' } }),
    'demo',
  );
  const first = rpc.mock.calls[0][1].p_subject;
  await limitRequest(
    new Request('https://example.test', { headers: { 'x-forwarded-for': 'different-ip' } }),
    'demo',
  );
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(rpc.mock.calls[1][1].p_subject).toBe(first);
});
it('fails closed on database failure and refuses exhausted budgets', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-secret');
  rpc.mockResolvedValue({ data: null, error: {} });
  await expect(limitRequest(new Request('https://example.test'), 'demo')).rejects.toMatchObject({
    status: 503,
  });
  rpc.mockResolvedValue({ data: false, error: null });
  await expect(limitRequest(new Request('https://example.test'), 'demo')).rejects.toMatchObject({
    status: 429,
  });
});
