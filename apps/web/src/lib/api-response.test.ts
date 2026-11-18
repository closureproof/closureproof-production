import { afterEach, expect, it, vi } from 'vitest';
import { readApiResponse, ApiResponseError } from './api-response';
import { enginePost } from './rules-assessment';
import { documentApi } from './document-analysis';
afterEach(() => vi.unstubAllGlobals());
it('retains valid data and the original structured validation explanation', async () => {
  await expect(
    readApiResponse(new Response('{"ready":true}'), 'Review preparation'),
  ).resolves.toEqual({ ready: true });
  await expect(
    readApiResponse(
      new Response('{"error":"Exception records disagree with the judgement."}', { status: 502 }),
      'Review preparation',
    ),
  ).rejects.toThrow('Exception records disagree with the judgement.');
});
it.each([502, 503, 504, 404, 403, 429])(
  'explains an HTML server response (%s) without exposing its contents',
  async (status) => {
    const response = new Response('<html>Private diagnostic stack</html>', {
      status,
      headers: { 'Content-Type': 'text/html' },
    });
    try {
      await readApiResponse(response, 'Review preparation');
      throw Error('Expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiResponseError);
      expect((error as ApiResponseError).status).toBe(status);
      expect((error as Error).message).not.toMatch(/JSON|Private diagnostic|<html>/);
    }
  },
);
it.each(['', 'null', '[]', '{"partial":', 'true'])(
  'rejects malformed or unexpected success bodies without treating them as prepared results (%s)',
  async (body) => {
    await expect(readApiResponse(new Response(body), 'Review preparation')).rejects.toThrow(
      'unreadable response',
    );
  },
);
it('assessment and document clients reject unreadable responses and never retry automatically', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('Gateway timeout', { status: 504 }))
    .mockResolvedValueOnce(new Response('Not JSON', { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(enginePost('propose', {})).rejects.toThrow('Review preparation timed out');
  await expect(documentApi.list()).rejects.toThrow(
    'Document analysis returned an unreadable response',
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
