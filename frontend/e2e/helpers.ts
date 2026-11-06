import { expect, type Page } from '@playwright/test';
export async function openWorkspace(page: Page) {
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Closure overview', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
}
