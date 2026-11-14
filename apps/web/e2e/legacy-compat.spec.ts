import { test, expect } from '@playwright/test';
test('old auth addresses open the dashboard and direct submission works without an account', async ({ page }) => {
  for (const path of ['/login', '/signup', '/reset-password', '/update-password']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: 'Closure overview' })).toBeVisible();
    await expect(page.getByLabel('Password')).toHaveCount(0);
  }
  await page.goto('/app/submission');await page.getByRole('button',{name:'Enter finding manually',exact:true}).click();
  await expect(page.getByLabel('Finding title', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create finding', exact: true })).toBeEnabled();
});
