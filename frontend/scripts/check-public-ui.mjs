// Read-only browser smoke check of the running app and its configured live project.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:3005/');
  await page.getByRole('link', { name: 'See how it works', exact: true }).click();
  await page.getByRole('heading', { name: 'Closure overview', exact: true }).waitFor();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Manual upload', exact: true }).click();
  await page.getByLabel('Finding title', { exact: true }).waitFor();
  await page.waitForTimeout(1000);
  const create = page.getByRole('button', { name: 'Create finding', exact: true });
  if (!(await create.isEnabled())) throw Error('Create finding remains disabled');
  if (await page.getByLabel('Password', { exact: true }).count()) throw Error('Login unexpectedly displayed');
  if (await page.getByRole('alert').count()) throw Error('An API error is visible on the submission page');
  if (errors.length) throw Error(errors.join('\n'));
  await page.screenshot({ path: '/tmp/closureproof-public-submission.png', fullPage: true });
  console.log('Live app: landing → dashboard → complete enabled submission form; no login or visible API error. No records submitted.');
} finally { await browser.close(); }
