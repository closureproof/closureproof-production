import { test, expect } from '@playwright/test';
const rest = 'http://127.0.0.1:54330/rest/v1/rpc/';
const headers = { apikey: 'sb_publishable_test_only', 'Content-Type': 'application/json' };
test('reviewer requests corrections and evidence; submitter responds and reviewer verifies without changing scope', async ({
  page,
  request,
}) => {
  const seed = await request.post(rest + 'cpp_test_ai_evidence', { headers, data: {} });
  expect(seed.ok()).toBeTruthy();
  const run = await seed.json();
  const review = '/app/reviews/' + run.finding_id,
    finding = '/app/findings/' + run.finding_id;
  await page.goto(review);
  await expect(page.getByRole('button', { name: 'Amend review scope', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Adopt control-based scope', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Request scope correction', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Request more evidence', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Previous review requests', exact: true }),
  ).toHaveCount(0);
  // Existing records remain readable/respondable after request creation moves to remediation.
  for (const [kind, message] of [
    ['scope', 'Please include independent retest and confirm the affected account scope.'],
    ['evidence', 'Provide the dated account reconciliation and completed review approvals.'],
  ]) {
    const result = await request.post(rest + 'cpp_review_request', {
      headers,
      data: {
        p_finding: run.finding_id,
        p_revision: run.finding_revision,
        p_request: crypto.randomUUID(),
        p_action: 'create',
        p_data: {
          kind,
          actor: 'Reviewer Taylor',
          reason: 'The current submission does not establish the required review basis.',
          requested_change: message,
        },
      },
    });
    expect(result.ok(), await result.text()).toBeTruthy();
  }
  await page.goto(finding);
  await expect(
    page.getByText('Please include independent retest and confirm the affected account scope.', {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Respond to request', exact: true }).first().click();
  await page.getByLabel('Request recorded by', { exact: true }).fill('IT Owner');
  await page
    .getByLabel('Response and supporting references', { exact: true })
    .fill('The additional records are being obtained; this response does not claim completion.');
  await page.getByRole('button', { name: 'Send response', exact: true }).click();
  await expect(
    page.getByText('Response recorded for reviewer verification.', { exact: true }),
  ).toBeVisible();
  await page.goto(review);
  await page.getByRole('button', { name: 'Verify response', exact: true }).click();
  await page.getByLabel('Request recorded by', { exact: true }).fill('Reviewer Taylor');
  await page
    .getByLabel('Verification and resolution notes', { exact: true })
    .fill('The request has been discussed; additional follow-up will be recorded separately.');
  await page.getByRole('button', { name: 'Resolve request', exact: true }).click();
  await expect(
    page.getByText('Request resolved. This does not complete the review or close the finding.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete Review', exact: true })).toHaveCount(0);
});
