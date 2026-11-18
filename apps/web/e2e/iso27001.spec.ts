import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const isoProtocolTemplates = JSON.parse(
  readFileSync(new URL('../src/features/manual-protocols.json', import.meta.url), 'utf8'),
) as { code: string; checks: { sourceTaskId: string }[] }[];

test('ten categories map to source requirements and the complete ISO-only library is searchable', async ({
  page,
}) => {
  await page.goto('/app/protocols');
  await expect(page.getByRole('heading', { name: 'Closure protocols', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(10);
  await expect(
    page.getByRole('heading', { name: 'Periodic access reviews', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Backup restoration testing', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'ISO 27001 checklist (153)', exact: true }).click();
  await expect(page.getByText('153 matching items', { exact: true })).toBeVisible();
  await page.getByLabel('Search ISO checklist', { exact: true }).fill('ACC-10');
  await expect(page.getByText('1 matching items', { exact: true })).toBeVisible();
  await page.getByText('ACC-10 · Access Reviews are Completed', { exact: true }).click();
  await expect(page.getByText('PDF p. 129', { exact: true })).toBeVisible();
  await page.getByText(/Source verification steps \(/).click();
  await expect(page.getByText('ACC-10.1', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.getByLabel('Search ISO checklist', { exact: true }).fill('ODOC-12');
  await expect(page.getByText('0 matching items', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test('legacy checklist adoption preserves category/history and reviewers cannot amend the scope', async ({
  page,
  request,
}, testInfo) => {
  const id =
    testInfo.project.name === 'mobile'
      ? '44444444-4444-4444-8444-444444444442'
      : '44444444-4444-4444-8444-444444444441';
  const backend = 'http://127.0.0.1:54330';
  await page.goto('/app/reviews/' + id);
  await expect(
    page.getByRole('button', { name: 'Request scope correction', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Apply selected checklist', exact: true }),
  ).toHaveCount(0);
  const taskIds = isoProtocolTemplates
    .find((template) => template.code === 'access')!
    .checks.map((check) => check.sourceTaskId);
  async function apply(ids: string[]) {
    const [finding] = await (
      await request.get(backend + '/rest/v1/cpp_findings?id=eq.' + id)
    ).json();
    // Legacy submission-side contract; scope editing is intentionally absent
    // from the reviewer UI. New findings use control-based scope selection.
    const response = await request.post(backend + '/rest/v1/rpc/cpp_apply_iso27001_checklist', {
      data: { p_id: id, p_revision: finding.revision, p_task_ids: ids },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  await apply(taskIds);
  await page.reload();
  await expect(page.locator('[data-protocol-check]')).toHaveCount(taskIds.length);
  await expect(
    page.getByRole('group', { name: 'ACC-10 · Access Reviews are Completed', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upload submitted evidence' })).toHaveCount(0);
  await apply([...taskIds, 'POL-04']);
  await page.reload();
  await expect(page.locator('[data-protocol-check]')).toHaveCount(taskIds.length + 1);
  await page.goto('/app/findings/' + id);
  await page.getByRole('tab', { name: 'Finding context', exact: true }).click();
  await expect(
    page.getByText('Periodic access reviews · 1.0-iso27001', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Review history', exact: true }).click();
  await expect(page.getByText(/Prior reviewer · published · revision 1 · Stale/)).toBeVisible();
});
