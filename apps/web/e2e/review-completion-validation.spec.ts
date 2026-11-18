import { test, expect } from '@playwright/test';
test('completion enforces assessment requirements and the temporary endpoint is retired', async ({
  page,
  request,
}) => {
  const seed = await request.post('http://127.0.0.1:54330/rest/v1/rpc/cpp_test_ai_evidence', {
    data: {},
  });
  expect(seed.ok()).toBe(true);
  const run = await seed.json();
  await page.goto('/app/reviews/' + run.finding_id);
  await page
    .getByRole('navigation', { name: 'Review steps' })
    .getByRole('button', { name: 'Recommendation & report', exact: true })
    .click();
  await page
    .getByLabel('Reviewer recommendation (manually selected)', { exact: true })
    .selectOption('Closure ready');
  await page.getByRole('button', { name: 'Complete Review', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Check the highlighted field:' }),
  ).toBeVisible();
  expect(
    await (
      await request.get(
        'http://127.0.0.1:54330/rest/v1/cpp_reviews?finding_id=eq.' +
          run.finding_id +
          '&status=eq.completed',
      )
    ).json(),
  ).toHaveLength(0);
  const response = await page.request.post('/api/assessments/complete-unrestricted', {
    data: {},
    headers: { origin: 'http://127.0.0.1:3006' },
  });
  expect(response.status()).toBe(404);
});
