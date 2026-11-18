import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { openJudgementDetails, openConclusionDetails } from './helpers';

test('submission selects a focused control checklist; scoped completion and later amendments preserve the assessed scope', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/submission');
  await page.getByRole('button', { name: 'Enter finding manually', exact: true }).click();
  await page.getByRole('checkbox', { name: /^A\.5\.18 ·/ }).check();
  await expect(
    page.getByText('5 checklist items · 6 review sections · mapping 1.0-control-scope', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText('Checklist and expected evidence', { exact: true }).click();
  await expect(
    page.getByText('ACC-10 · Access Reviews are Completed', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('DOC-14 · Data restore test', { exact: true })).toHaveCount(0);
  for (const [label, value] of Object.entries({
    'Finding title': 'Focused access review ' + test.info().project.name,
    'Finding description': 'The access register omits several privileged accounts.',
    'Remediation owner': 'IT Operations',
    'Source account / environment reference': 'Production identity service',
    'Affected systems / environment': 'Production',
    'Affected identities and resource references': 'Accounts A and B',
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Create finding', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Focused access review ' + test.info().project.name,
      exact: true,
    }),
  ).toBeVisible();
  const findingUrl = page.url();
  await expect(page.getByRole('link', { name: 'Open review', exact: true })).toHaveCount(0);
  await page.goto(findingUrl.replace('/app/findings/', '/app/reviews/'));
  await expect(page.locator('[data-protocol-check]')).toHaveCount(5);
  await expect(
    page.getByRole('group', { name: 'Independent retest assessment', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Amend review scope', exact: true })).toHaveCount(
    0,
  );
  await page.goto(findingUrl);
  await page.getByRole('button', { name: 'Amend review scope', exact: true }).click();
  await page.getByText('Amend checklist items and conditional sections', { exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Operating history and deadline assessment', exact: true })
    .uncheck();
  await page
    .getByLabel('Reason to exclude operation module', { exact: true })
    .fill('This is a single access-removal action with no operating-history claim.');
  await page.getByLabel('Scope amendment recorded by', { exact: true }).fill('Reviewer Taylor');
  await page
    .getByLabel('Reason for scope amendment', { exact: true })
    .fill('Focus this review on the specific one-time corrective action.');
  await page.getByRole('button', { name: 'Confirm review scope change', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open review', exact: true })).toHaveCount(0);
  await page.goto(findingUrl.replace('/app/findings/', '/app/reviews/'));
  await expect(page.locator('#judgement-operation')).toHaveCount(0);
  await expect(page.locator('#judgement-retest')).toHaveCount(0);
  await expect(page.locator('fieldset[id^="judgement-"]')).toHaveCount(5);
  const review = page.locator('[data-review-form]');
  const steps = page.getByRole('navigation', { name: 'Review steps', exact: true });
  await review.getByLabel('Reviewer', { exact: true }).fill('Reviewer Taylor');
  await expect(
    review.getByLabel('Review conclusion and rationale', { exact: true }),
  ).not.toBeVisible();
  await expect(review.getByRole('button', { name: 'Complete Review', exact: true })).toHaveCount(0);
  await review
    .getByLabel('Shared explanation for Not assessed checks', { exact: true })
    .fill(
      'Source records have not been supplied; these checks remain unassessed pending further evidence.',
    );
  await review.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(review.getByLabel('Reviewer', { exact: true })).not.toBeVisible();
  await openJudgementDetails(page);
  await review
    .getByLabel('Root-cause classification', { exact: true })
    .selectOption('Incomplete population');
  await review.getByLabel('Coverage approach', { exact: true }).selectOption('Sample');
  for (const field of await review
    .locator('[data-review-step="1"] fieldset[id^="judgement-"] textarea:visible')
    .all())
    await field.fill('The reviewer documented the scope and remaining evidence limitations.');
  await review.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0);
  await review
    .getByLabel('Review conclusion and rationale', { exact: true })
    .fill('The source records remain incomplete; further evidence is requested.');
  await openConclusionDetails(page);
  for (const field of await review.locator('#judgement-conclusion textarea:visible').all())
    await field.fill(
      'The remaining evidence gaps and limitations require further corrective action.',
    );
  await review
    .getByLabel('Reviewer recommendation (manually selected)', { exact: true })
    .selectOption('Not closure ready');
  await review
    .getByLabel('Outstanding actions, owners and evidence requests', { exact: true })
    .fill('Submit the complete population and evidence of removal of access.');
  await review.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(review.getByLabel('Root-cause classification', { exact: true })).toHaveValue(
    'Incomplete population',
  );
  await review.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(review.getByLabel('Review conclusion and rationale', { exact: true })).toHaveValue(
    'The source records remain incomplete; further evidence is requested.',
  );
  await review.getByRole('button', { name: 'Complete Review', exact: true }).click();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(
    'Confirm the review scope before completion.',
  );
  await expect(review.getByLabel('Reviewer', { exact: true })).toBeVisible();
  await review.getByRole('checkbox', { name: /^I confirm that the selected controls/ }).check();
  await steps.getByRole('button', { name: /Recommendation & report/ }).click();
  await review.getByRole('button', { name: 'Complete Review', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Assessment .*Completed/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download report PDF', exact: true }),
  ).toBeVisible();
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report PDF', exact: true }).click();
  await (await pdf).saveAs(test.info().outputPath('scoped-assessment.pdf'));
  const zip = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download evidence pack', exact: true }).click();
  const contents = unzipSync(new Uint8Array(await fs.readFile((await (await zip).path())!)));
  const manifest = JSON.parse(new TextDecoder().decode(contents['manifest.json']));
  expect(manifest.review_scope.control_ids).toEqual(['A.5.18']);
  expect(manifest.review_scope.modules).not.toContain('operation');
  await expect(page.getByRole('button', { name: 'Amend review scope', exact: true })).toHaveCount(
    0,
  );
  await page.goto(findingUrl);
  await page.getByRole('button', { name: 'Amend review scope', exact: true }).click();
  await page.getByLabel('Search ISO controls', { exact: true }).fill('A.8.13');
  await page.getByRole('checkbox', { name: /^A\.8\.13 ·/ }).check();
  await page.getByLabel('Scope amendment recorded by', { exact: true }).fill('Reviewer Taylor');
  await page
    .getByLabel('Reason for scope amendment', { exact: true })
    .fill('The new finding scope includes backup records and requires reassessment.');
  await page.getByRole('button', { name: 'Confirm review scope change', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Submit remediation for review', exact: true }),
  ).toBeVisible();
  await page.goto(findingUrl);
  await page.getByRole('tab', { name: 'Review history', exact: true }).click();
  await page.getByText(/Reviewer Taylor · completed/).click();
  await expect(page.getByText(/Controls: A\.5\.18 · Mapping/)).toBeVisible();
  await expect(
    page.getByText('Shared explanation for unassessed checks', { exact: true }),
  ).toHaveCount(5);
  await expect(page.getByText('Applicable: Under review', { exact: true })).toHaveCount(5);
  await expect(page.getByText(/ACC-10 · Access Reviews are Completed: Not assessed/)).toBeVisible();
  await expect(page.getByText(/operation: Outside this assessment scope/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('SoA theme sections retain selections across themes, searches and removals', async ({
  page,
}) => {
  await page.goto('/app/submission');
  await page.getByRole('button', { name: 'Enter finding manually', exact: true }).click();
  const sections = page.getByRole('group', { name: 'Control sections', exact: true });
  const available = page.getByRole('group', { name: 'Available ISO controls', exact: true });
  const selected = page.getByRole('region', { name: 'Selected ISO controls', exact: true });
  await expect(sections.getByRole('button', { name: 'Suggested', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await available.getByRole('checkbox', { name: /^A\.5\.18 ·/ }).check();
  await sections.getByRole('button', { name: 'Technological (34)', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(available.getByRole('checkbox')).toHaveCount(34);
  await available.getByRole('checkbox', { name: /^A\.8\.13 ·/ }).check();
  await expect(selected.getByRole('button', { name: 'Remove A.5.18', exact: true })).toBeVisible();
  await expect(selected.getByRole('button', { name: 'Remove A.8.13', exact: true })).toBeVisible();
  await sections.getByRole('button', { name: 'People (8)', exact: true }).click();
  await expect(available.getByRole('checkbox')).toHaveCount(8);
  await available.getByRole('checkbox', { name: /^A\.6\.5 ·/ }).check();
  await sections.getByRole('button', { name: 'Physical (14)', exact: true }).click();
  await expect(available.getByRole('checkbox')).toHaveCount(14);
  await available.getByRole('checkbox', { name: /^A\.7\.1 ·/ }).check();
  await expect(page.getByLabel('Reason for provisional scope', { exact: true })).toBeVisible();
  await selected.getByRole('button', { name: 'Remove A.7.1', exact: true }).click();
  await expect(page.getByLabel('Reason for provisional scope', { exact: true })).toHaveCount(0);
  await page.getByLabel('Search ISO controls', { exact: true }).fill('no-matching-control');
  await expect(available.getByRole('checkbox')).toHaveCount(0);
  await expect(available).toContainText('Selections in other sections are retained.');
  await expect(selected.getByRole('button')).toHaveCount(3);
  await page.getByLabel('Search ISO controls', { exact: true }).fill('');
  await sections.getByRole('button', { name: 'All controls (93)', exact: true }).click();
  await expect(available.getByRole('checkbox')).toHaveCount(93);
  for (const id of ['A.5.18', 'A.8.13', 'A.6.5'])
    await expect(
      available.getByRole('checkbox', { name: new RegExp('^' + id.replaceAll('.', '\\.') + ' ·') }),
    ).toBeChecked();
  await sections.getByRole('button', { name: 'Organisational (37)', exact: true }).click();
  await expect(available.getByRole('checkbox')).toHaveCount(37);
  await page.getByLabel('Search ISO controls', { exact: true }).fill('A.5.18');
  await expect(available.getByRole('checkbox')).toHaveCount(1);
  await expect(
    sections.getByRole('button', { name: 'Organisational (37)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await selected.getByRole('button', { name: 'Remove A.8.13', exact: true }).click();
  await expect(selected.getByRole('button')).toHaveCount(2);
  await page.getByLabel('Search ISO controls', { exact: true }).fill('');
  await sections.getByRole('button', { name: 'Suggested', exact: true }).click();
  await page.getByLabel('Search ISO controls', { exact: true }).fill('A.8.13');
  await expect(
    sections.getByRole('button', { name: 'All controls (93)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(available.getByRole('checkbox', { name: /^A\.8\.13 ·/ })).not.toBeChecked();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
