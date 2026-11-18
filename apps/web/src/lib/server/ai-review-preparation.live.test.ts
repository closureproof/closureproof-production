import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
vi.mock('server-only', () => ({}));
import { interpretReview, type ReviewContext } from './ai-review-preparation';
it.runIf(process.env.RUN_AI_REVIEW_LIVE_SMOKE === '1')(
  'configured OpenAI accepts the real AI-review structured-output contract with synthetic facts',
  async () => {
    const config = parseEnv(readFileSync('.env.local', 'utf8'));
    for (const name of ['AI_EXTRACTION_ENABLED', 'OPENAI_API_KEY', 'OPENAI_EXTRACTION_MODEL'])
      if (config[name]) process.env[name] = config[name];
    const id = '11111111-1111-4111-8111-111111111111';
    const context: ReviewContext = {
      finding: {
        id,
        revision: 1,
        details: {
          title: 'Synthetic contract check only',
          description: 'Synthetic privileged activity records need review.',
        },
        protocol: {
          code: 'aws-iam',
          title: 'AWS IAM',
          category: 'Access',
          version: 'contract-smoke-only',
          status: 'candidate',
          checks: [
            {
              id: 'iso-ACC-08',
              label: 'Privileged activity records',
              guidance: 'Inspect attributable privileged activity records.',
              mandatory: true,
              evaluationKind: 'human_attestation',
            },
          ],
        },
      },
      facts: [
        {
          key: id + ':0',
          runId: id,
          index: 0,
          evidenceId: '22222222-2222-4222-8222-222222222222',
          version: 1,
          sha256: 'a'.repeat(64),
          filename: 'synthetic-evidence.pdf',
          label: 'Recorded activity coverage',
          value:
            'The synthetic document records 8 privileged accounts with activity logs for 7; one account has no activity evidence. Root cause, required operating duration and independent retest are not established by this document.',
          quote:
            'Eight privileged accounts are listed; seven have attributable activity logs. One account lacks activity evidence.',
          locator: 'Synthetic activity review summary',
          page: 1,
        },
      ],
      unanalysed: [],
    };
    const result = await interpretReview(
      context,
      process.env.OPENAI_EXTRACTION_MODEL || 'gpt-4.1-mini',
    );
    expect(result.output).not.toHaveProperty('recommendation');
    expect(result.prepared.checks).toHaveLength(1);
    expect(result.prepared.checks[0].check_id).toBe('iso-ACC-08');
    expect(result.prepared.engine.entries.coverage?.value).not.toBe('true');
  },
  120000,
);
