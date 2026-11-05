import { test, expect } from '@playwright/test';
test('public walkthrough works on desktop and mobile', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('link', { name: 'See how it works' }).click();
  await expect(page).toHaveURL(/dashboard.html$/);
  await expect(page.getByRole('heading', { name: 'Is “complete” really complete?' })).toBeVisible();
  await expect(page.getByText('Sample data · Read-only demo')).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
test('deep links survive refresh and preview finding drafts work', async ({ page }) => {
  await page.goto('/preview/findings/new');
  await page.getByLabel('Finding title').fill('Browser test finding');
  await page.getByLabel('Description', { exact: true }).fill('A synthetic finding for frontend review.');
  await page.getByLabel('ISO / control reference').fill('A.5.18');
  await page.getByLabel('Accountable owner').fill('Test owner');
  await page.getByLabel('Due date').fill('2026-12-20');
  await page.getByLabel('Affected scope').fill('Test system');
  await page.getByRole('button', { name: 'Save preview draft' }).click();
  await expect(page.getByRole('heading', { name: 'Browser test finding' })).toBeVisible();
  await expect(page.getByText('No server assessment has been run for this revision.')).toBeVisible();
  await page.goto('/preview/findings/CP-1042'); await page.reload();
  await expect(page.getByRole('heading', { name: 'Quarterly privileged-access reviews missed' })).toBeVisible();
});
test('integrations are informational and deferred app routes offer a demo', async ({ page }) => {
  await page.goto('/app/findings'); await expect(page).toHaveURL(/request-demo$/);
  await page.goto('/preview/integrations'); await expect(page.getByText('Planned integration', { exact: true })).toHaveCount(10);
  await expect(page.getByRole('button', { name: /^Connect$/ })).toHaveCount(0);
});

test('request demo collects contact details without exposing a sign-in flow', async ({ page, isMobile }) => {
  await page.goto('/request-demo');
  await expect(page).toHaveURL(/request-demo$/);
  await page.getByRole('button', { name: 'Request demo' }).click();
  await expect(page.getByLabel('Your name')).toBeFocused();
  await page.getByLabel('Your name').fill('Jamie Test');
  await page.getByLabel('Your email').fill('jamie@example.test');
  await page.getByLabel('Company name').fill('Example Ltd');
  await page.getByLabel('Contact person’s name').fill('Taylor Contact');
  await page.getByLabel('Contact person’s email (optional)').fill('taylor@example.test');
  await page.getByLabel('Contact phone (optional)').fill('+44 20 0000 0000');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Request demo' }).click();
  await expect(page.getByRole('alert')).toContainText('Your details have not been sent');
  await expect(page.getByLabel('Your email')).toHaveValue('jamie@example.test');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('workspace navigation and finding controls remain usable at each viewport', async ({ page, isMobile }) => {
  await page.goto('/preview');
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: /Findings/ }).click();
  await page.getByRole('textbox', { name: 'Search findings' }).fill('CP-1042');
  await page.getByRole('link', { name: 'Quarterly privileged-access reviews missed' }).click();
  await page.getByRole('tab', { name: 'Evidence', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evidence manifest' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('provider carousel moves, pauses and honours reduced motion', async ({ page }) => {
  await page.goto('/');
  const region = page.getByRole('region', { name: 'Provider logo carousel' });
  const track = region.locator('[data-provider-track]');
  const transform = () => track.evaluate(el => getComputedStyle(el).transform);
  const before = await transform();
  await page.waitForTimeout(200);
  expect(await transform()).not.toBe(before);
  const carousel = region.locator('..');
  await expect(carousel.getByRole('button')).toHaveCount(0);
  await carousel.hover();
  await expect.poll(() => track.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const paused = await transform();
  await page.waitForTimeout(200);
  expect(await transform()).toBe(paused);
  await page.mouse.move(0, 0);
  await expect.poll(() => track.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('running');
  const resumed = await transform();
  await page.waitForTimeout(200);
  expect(await transform()).not.toBe(resumed);
  const logos = page.locator('img[src^="/brand/providers/"]');
  await expect.poll(() => logos.evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBeTruthy();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => track.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect(region.locator('.provider-copy')).toBeHidden();
  for (const name of ['Okta', 'GitHub', 'ServiceNow', 'Tenable', 'Qualys', 'CrowdStrike', 'Microsoft Defender', 'Veeam', 'Rubrik']) {
    await expect(region.locator('.provider-set:not(.provider-copy)').getByRole('img', { name: name + ' logo', exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});


test('survey callout opens a new tab and final footer offers a demo', async ({ page }) => {
  await page.route('https://docs.google.com/forms/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Survey link fixture</body></html>' }));
  await page.goto('/');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Request demo', exact: true }).first()).toHaveAttribute('href', '/request-demo');
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Request demo' })).toHaveAttribute('href', '/request-demo');
  const survey = page.getByRole('link', { name: 'Take the survey (opens in a new tab)' });
  await expect(survey).toHaveAttribute('target', '_blank');
  await expect(survey).toHaveAttribute('href', 'https://docs.google.com/forms/d/1OpRXm_gaHUzvv4-H2DwuDGJMplLEieuVGlOmesQzoyo/viewform?edit_requested=true');
  await expect(survey).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
