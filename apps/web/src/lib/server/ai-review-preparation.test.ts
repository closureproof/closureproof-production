import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { interpretReview, type ReviewContext } from './ai-review-preparation';
const context: ReviewContext = {
  finding: {
    id: 'finding',
    revision: 1,
    protocol: {
      code: 'aws-iam',
      title: 'AWS IAM',
      category: 'Access',
      version: 'test',
      status: 'draft',
      checks: [],
    },
    details: {},
  },
  facts: [],
  unanalysed: [],
};
const empty = {
  checklist: [],
  engine: [],
  judgements: [],
  population: { expected: null, reviewed: null, source_refs: [] },
  exceptions: [],
  summary: 'No supported assessment facts are available.',
  next_actions: 'Supply the original evidence records.',
  limitations: [],
  conflicts: [],
};
beforeEach(() => {
  vi.stubEnv('AI_EXTRACTION_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'test-key-only');
});
afterEach(() => vi.unstubAllEnvs());
it('uses strict structured output on server-side OpenAI without tools or readiness output fields', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'completed',
        output: [{ content: [{ type: 'output_text', text: JSON.stringify(empty) }] }],
      }),
    ),
  );
  await interpretReview(context, 'gpt-4.1-mini', fetcher);
  const [url, options] = fetcher.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(url).toBe('https://api.openai.com/v1/responses');
  expect(body.store).toBe(false);
  expect(body.tools).toBeUndefined();
  expect(body.text.format.strict).toBe(true);
  expect(body.text.format.schema.properties).not.toHaveProperty('recommendation');
});
it('does not automatically retry refusal, incomplete output or provider errors', async () => {
  for (const response of [
    new Response('{}', { status: 429 }),
    new Response(JSON.stringify({ status: 'incomplete', output: [] })),
    new Response(
      JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }),
    ),
  ]) {
    const fetcher = vi.fn().mockResolvedValue(response);
    await expect(interpretReview(context, 'gpt-4.1-mini', fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});

it('retains known extraction limitations even when the provider omits them', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'completed',
        output: [{ content: [{ type: 'output_text', text: JSON.stringify(empty) }] }],
      }),
    ),
  );
  const result = await interpretReview(
    {
      ...context,
      documentLimitations: ['source.pdf: partial extraction'],
      unanalysed: ['unsupported.csv'],
    },
    'gpt-4.1-mini',
    fetcher,
  );
  expect(result.output.limitations).toContain('source.pdf: partial extraction');
  expect(result.output.limitations).toContain(
    'No usable extracted evidence facts: unsupported.csv',
  );
});
