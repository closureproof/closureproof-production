import { test, expect } from '@playwright/test';
test('public walkthrough opens the demo form; workspace remains direct-only', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator(
      'a[href^="/app"], a[href^="/preview"], a[href^="/workbench"], a[href^="/dashboard.html"]',
    ),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'See how it works', exact: true }).click();
  await expect(page).toHaveURL(/\/request-demo$/);
  await expect(page.getByRole('heading', { name: 'Request demo', exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/app"], a[href^="/dashboard.html"]')).toHaveCount(0);
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Closure overview', exact: true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('request demo saves contact details in Supabase without exposing a sign-in flow', async ({
  page,
  request,
}) => {
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
  await expect(page.getByText('Request sent', { exact: true })).toBeVisible();
  const saved = await request.get(
    'http://127.0.0.1:54330/rest/v1/demo_requests?email=eq.jamie%40example.test',
    {
      headers: {
        apikey: 'test_service_role_fixture_only',
        authorization: 'Bearer test_service_role_fixture_only',
      },
    },
  );
  expect(saved.ok()).toBeTruthy();
  const rows = await saved.json();
  expect(
    rows.some(
      (row: any) => row.company_name === 'Example Ltd' && row.contact_person === 'Taylor Contact',
    ),
  ).toBe(true);
  const anonymous = await request.get('http://127.0.0.1:54330/rest/v1/demo_requests', {
    headers: { apikey: 'sb_publishable_test_only' },
  });
  expect(anonymous.status()).toBe(403);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await expect(page).toHaveURL(/\/$/, { timeout: 6000 });
  await expect(page.getByRole('link', { name: 'See how it works', exact: true })).toBeVisible();
});

test('provider carousel moves, pauses and honours reduced motion', async ({ page }) => {
  await page.goto('/');
  const region = page.getByRole('region', { name: 'Provider logo carousel' });
  const track = region.locator('[data-provider-track]');
  const transform = () => track.evaluate((el) => getComputedStyle(el).transform);
  const before = await transform();
  await page.waitForTimeout(200);
  expect(await transform()).not.toBe(before);
  const carousel = region.locator('..');
  await expect(carousel.getByRole('button')).toHaveCount(0);
  await carousel.hover();
  await expect
    .poll(() => track.evaluate((el) => getComputedStyle(el).animationPlayState))
    .toBe('paused');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const paused = await transform();
  await page.waitForTimeout(200);
  expect(await transform()).toBe(paused);
  await page.mouse.move(0, 0);
  await expect
    .poll(() => track.evaluate((el) => getComputedStyle(el).animationPlayState))
    .toBe('running');
  const resumed = await transform();
  await page.waitForTimeout(200);
  expect(await transform()).not.toBe(resumed);
  const logos = page.locator('img[src^="/brand/providers/"]');
  await expect
    .poll(() =>
      logos.evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
    )
    .toBeTruthy();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => track.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(region.locator('.provider-copy')).toBeHidden();
  for (const name of [
    'Okta',
    'GitHub',
    'ServiceNow',
    'Tenable',
    'Qualys',
    'CrowdStrike',
    'Microsoft Defender',
    'Veeam',
    'Rubrik',
  ]) {
    await expect(
      region
        .locator('.provider-set:not(.provider-copy)')
        .getByRole('img', { name: name + ' logo', exact: true }),
    ).toBeVisible();
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test('survey callout opens a new tab and final footer offers a demo', async ({ page }) => {
  await page.route('https://docs.google.com/forms/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Survey link fixture</body></html>',
    }),
  );
  await page.goto('/');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Request demo', exact: true }).first(),
  ).toHaveAttribute('href', '/request-demo');
  await expect(
    page.getByRole('contentinfo').getByRole('link', { name: 'Request demo' }),
  ).toHaveAttribute('href', '/request-demo');
  const survey = page.getByRole('link', { name: 'Take the survey (opens in a new tab)' });
  await expect(survey).toHaveAttribute('target', '_blank');
  await expect(survey).toHaveAttribute(
    'href',
    'https://docs.google.com/forms/d/1OpRXm_gaHUzvv4-H2DwuDGJMplLEieuVGlOmesQzoyo/viewform?edit_requested=true',
  );
  await expect(survey).toHaveAttribute('rel', 'noopener noreferrer');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
