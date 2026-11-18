import { afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { Blob } from 'node:buffer';
vi.mock('server-only', () => ({}));
vi.mock('../../../../lib/server/request-limit', () => ({ limitRequest: vi.fn() }));
const { single, download, rpc } = vi.hoisted(() => ({
  single: vi.fn(),
  download: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('../../../../lib/server/document-analysis', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../../lib/server/document-analysis')>();
  const query: any = { select: () => query, eq: () => query, single };
  return {
    ...original,
    analysisAdmin: () => ({ from: () => query, storage: { from: () => ({ download }) }, rpc }),
  };
});
import { POST } from './route';
const id = '11111111-1111-4111-8111-111111111111';
const request = () =>
  new Request('https://closureproof.example/api/evidence/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, revision: 1 }),
  });
afterEach(() => vi.resetAllMocks());
it('does not finalise a file with forged content metadata', async () => {
  const bytes = Buffer.from('Not a PDF');
  single.mockResolvedValue({
    data: {
      id,
      object_path: 'pending/file',
      upload_state: 'pending',
      mime: 'application/pdf',
      byte_size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    error: null,
  });
  download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  expect((await POST(request())).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('finalises only after checking the stored original bytes', async () => {
  const bytes = Buffer.from('Evidence text');
  single.mockResolvedValue({
    data: {
      id,
      object_path: 'pending/file',
      upload_state: 'pending',
      mime: 'text/plain',
      byte_size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    error: null,
  });
  download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  rpc.mockResolvedValue({ error: null });
  expect((await POST(request())).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('cpp_finalize_upload', { p_id: id, p_revision: 1 });
});
