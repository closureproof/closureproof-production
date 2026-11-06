import { test, expect } from '@playwright/test';

test('ten categories map to source requirements and the complete ISO-only library is searchable', async ({ page }) => {
  await page.goto('/app/protocols');
  await expect(page.getByRole('heading', { name: 'Closure protocols', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(10);
  await expect(page.getByRole('heading', { name: 'Periodic access reviews', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backup restoration testing', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'ISO 27001 checklist (153)', exact: true }).click();
  await expect(page.getByText('153 matching items', { exact: true })).toBeVisible();
  await page.getByLabel('Search ISO checklist', { exact: true }).fill('ACC-10');
  await expect(page.getByText('1 matching items', { exact: true })).toBeVisible();
  await page.getByText('ACC-10 · Access Reviews are Completed', { exact: true }).click();
  await expect(page.getByText('PDF p. 129', { exact: true })).toBeVisible();
  await page.getByText(/Source verification steps \(/).click();
  await expect(page.getByText('ACC-10.1', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByLabel('Search ISO checklist', { exact: true }).fill('ODOC-12');
  await expect(page.getByText('0 matching items', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('adopting scoped ISO requirements preserves the original category and prior review history', async ({ page }, testInfo) => {
  const id = testInfo.project.name === 'mobile' ? '44444444-4444-4444-8444-444444444442' : '44444444-4444-4444-8444-444444444441';
  await page.goto('/app/reviews/' + id);
  await expect(page.getByText('Apply the ISO 27001 checklist to this finding', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use category defaults', exact: true }).click();
  await page.getByRole('button', { name: 'Apply selected checklist', exact: true }).click();
  await expect(page.locator('[data-protocol-check]')).toHaveCount(12);
  await expect(page.getByRole('group', { name: 'ACC-10 · Access Reviews are Completed', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upload submitted evidence' })).toHaveCount(0);
  await expect(page.getByText('Checklist scope · 12 selected items', { exact: true })).toBeVisible();
  await expect(page.getByText('No current reviewer recommendation', { exact: true })).toHaveCount(0);
  await page.getByText('Checklist scope · 12 selected items', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show all 153 ISO 27001 tasks', exact: true }).check();
  await page.getByLabel('Search checklist scope', { exact: true }).fill('POL-04');
  await page.getByRole('checkbox', { name: /POL-04 · Procedure for Internal Audits/ }).check();
  await page.getByRole('button', { name: 'Apply selected checklist', exact: true }).click();
  await expect(page.locator('[data-protocol-check]')).toHaveCount(13);
  await page.reload();
  await expect(page.locator('[data-protocol-check]')).toHaveCount(13);
  await page.goto('/app/findings/' + id);
  await page.getByRole('tab', { name: 'Finding context', exact: true }).click();
  await expect(page.getByText('Periodic access reviews · 1.0-iso27001', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Review history', exact: true }).click();
  await expect(page.getByText(/Prior reviewer · published · revision 1 · Stale/)).toBeVisible();
});
