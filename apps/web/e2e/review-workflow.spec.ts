import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { judgementSections } from '../src/features/review-judgement';
import fs from 'node:fs/promises';
import { unzipSync } from 'fflate';

const service = 'http://127.0.0.1:54330';
async function rpc(request: APIRequestContext, name: string, body: Record<string, unknown>) {
  const response = await request.post(`${service}/rest/v1/rpc/${name}`, { data: body });
  const data = await response.json();
  expect(response.ok(), JSON.stringify(data)).toBeTruthy();
  return data;
}
async function row(request: APIRequestContext, table: string, id: string) {
  const response = await request.get(`${service}/rest/v1/${table}?id=eq.${id}`);
  return (await response.json())[0];
}
async function confirm(page: Page, action: string) {
  await page.getByRole('button', { name: action, exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Reviewer Morgan');
}

test('completed assessment survives PDF failure; corrected review, rejection, resubmission and final closure retain history', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const id = await rpc(request, 'cpp_create_finding', {
    p_org: '00000000-0000-4000-8000-000000000001',
    p_details: {
      title: `Workflow acceptance ${test.info().project.name}`,
      description: 'Review the submitted scope and supporting records.',
      owner: 'IT Operations',
      severity: 'Medium',
      protocol_code: 'access',
      account_reference: 'Test environment',
      affected_systems: 'Identity platform',
      resources: 'User register',
      root_cause: 'Incomplete register',
      corrective_action: 'Reconcile the register',
      approved_baseline: 'Approved identity list',
      recurrence_prevention: 'Monthly reconciliation',
      implementation_date: null,
      deadline: null,
      control_reference: 'A.5.18',
    },
  });
  const finding = await row(request, 'cpp_findings', id);
  const judgement: Record<string, unknown> = {
    root_cause_type: 'Incomplete population',
    retest_status: 'Not performed',
    closure_ready_acknowledged: true,
  };
  for (const section of judgementSections)
    for (const field of section.fields)
      if (!('type' in field) && !('options' in field))
        judgement[field.key] =
          'Reviewer documented the scope, uncertainty and basis for the selected recommendation.';
  const body = {
    reviewer: 'Reviewer Morgan',
    reviewer_conclusion: 'Further records are required to confirm complete coverage.',
    independent: false,
    checks: finding.protocol.checks.map((c: { id: string }) => ({
      check_id: c.id,
      result: 'unknown',
      applicability: 'under_review',
      implementation_status: 'not_assessed',
      reason: 'The scope requires further documentation before implementation can be established.',
      evidence_ids: [],
      source_location: '',
    })),
    closure_judgement: judgement,
    recommendation: 'Not closure ready',
    recommendation_reason:
      'The reviewed population is not yet supported by complete source evidence.',
    clarification_request: 'Provide the complete population and corrective action records.',
    population_expected: 10,
    population_reviewed: 8,
    exceptions_assessed: true,
    exception_entries: [],
  };
  await rpc(request, 'cpp_complete_review', {
    p_finding: id,
    p_revision: 1,
    p_review: body,
    p_request_id: crypto.randomUUID(),
    p_supersedes: null,
  });
  await page.route('**/fonts/NotoSans-Regular.ttf', (route) => route.abort());
  await page.goto('/app/reviews/' + id);
  await expect(
    page.getByRole('button', { name: 'Retry report generation', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /Assessment .*Completed/ })).toBeVisible();
  await page.unroute('**/fonts/NotoSans-Regular.ttf');
  await page.getByRole('button', { name: 'Retry report generation', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Download report PDF', exact: true }),
  ).toBeVisible();
  const firstDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report PDF', exact: true }).click();
  await (await firstDownload).saveAs(test.info().outputPath('insufficient-report.pdf'));
  await page.getByRole('button', { name: 'Create assessment revision', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Evidence & checklist', exact: true }),
  ).toBeInViewport();
  await page.goto('/app/reviews?submission=' + encodeURIComponent('finding:' + id));
  const findingCard = page.getByRole('article').filter({
    has: page.getByRole('link', {
      name: `Workflow acceptance ${test.info().project.name}`,
      exact: true,
    }),
  });
  const editReview = findingCard.getByRole('link', { name: 'Edit review', exact: true });
  await expect(editReview).toHaveAttribute(
    'href',
    new RegExp('/app/reviews/' + id + '\\?assessment='),
  );
  await editReview.click();
  await expect(
    page.getByRole('heading', { name: 'Evidence & checklist', exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByText('Editing a revision of the completed assessment.', { exact: false }),
  ).toBeVisible();
  const form = page.locator('[data-review-form]');
  await expect(form.getByLabel('Reviewer', { exact: true })).toHaveValue(body.reviewer);
  await page
    .getByRole('navigation', { name: 'Review steps', exact: true })
    .getByRole('button', { name: /Gaps & exceptions/ })
    .click();
  await form
    .getByLabel('Scope and evidence assessment', { exact: true })
    .selectOption('Sufficient for this finding');
  await form
    .getByLabel('Root cause and corrective-action assessment', { exact: true })
    .selectOption('Supported');
  for (const [label, reasonLabel] of [
    ['Is population coverage review needed?', 'Reason for the population-review decision'],
    ['Is operating-history review needed?', 'Reason for the operating-history decision'],
    ['Is an independent retest needed?', 'Reason for the retest decision'],
  ]) {
    await form.getByLabel(label, { exact: true }).selectOption('Not required');
    await form
      .getByLabel(reasonLabel, { exact: true })
      .fill(
        'The documentary correction does not need this additional review; the assessed scope is recorded.',
      );
  }
  await page
    .getByRole('navigation', { name: 'Review steps', exact: true })
    .getByRole('button', { name: /Recommendation & report/ })
    .click();
  await form.getByLabel('Is follow-up required?', { exact: true }).selectOption('None required');
  await form
    .getByLabel('Are there limitations or judgement overrides?', { exact: true })
    .selectOption('None identified');
  await form
    .getByLabel('Review conclusion and rationale', { exact: true })
    .fill(
      'The documented limitations and exceptions have been assessed; corrected recommendation recorded.',
    );
  await form
    .getByLabel('Reviewer recommendation (manually selected)', { exact: true })
    .selectOption('Closure ready');
  await form.getByRole('button', { name: 'Save review draft', exact: true }).click();
  await expect(form).toBeVisible();
  await form.getByRole('button', { name: 'Complete Review', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Closure Evidence Pack', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Submit for Final Approval', exact: true }),
  ).toBeEnabled();
  const waivedReport = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report PDF', exact: true }).click();
  await (await waivedReport).saveAs(test.info().outputPath('waived-review.pdf'));
  await confirm(page, 'Submit for Final Approval');
  await page.getByRole('button', { name: 'Confirm action', exact: true }).click();
  await page.getByRole('button', { name: 'Record approval decision', exact: true }).click();
  await page.getByLabel('Recorded by', { exact: true }).fill('Decision recorder');
  await page.getByLabel('Approval decision', { exact: true }).selectOption('rejected');
  await page.getByLabel('Decision-maker name', { exact: true }).fill('External Auditor Avery');
  await page.getByLabel('Decision-maker organisation', { exact: true }).fill('Audit Firm');
  await page.getByLabel('Decision date', { exact: true }).fill('2026-01-01');
  await page
    .getByLabel('Decision reason', { exact: true })
    .fill('Additional records are requested by the actual decision-maker.');
  await page
    .getByLabel('Supporting decision reference / document link', { exact: true })
    .fill('AUD-REF-001');
  await page.getByLabel('Action owner / retest contact', { exact: true }).fill('IT Operations');
  await page
    .getByLabel('Requested actions / retest scope', { exact: true })
    .fill('Supply the remaining population records.');
  await page
    .getByLabel('Evidence required', { exact: true })
    .fill('Complete population source records and reconciliation.');
  await page.getByRole('button', { name: 'Confirm action', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Approval rejected', exact: true })).toBeVisible();
  await page.goto('/app/findings/' + id);
  await page.getByLabel('Your name', { exact: true }).fill('Reviewer Morgan');
  await page
    .getByLabel('Changes and response to requests', { exact: true })
    .fill('The additional requested records have been resubmitted.');
  await page.getByRole('button', { name: 'Submit remediation for review', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Remediation submitted for review.' }),
  ).toBeVisible();
  await page.goto('/app/reviews/' + id);
  await expect(page.getByRole('navigation', { name: 'Review steps', exact: true })).toBeVisible();
  // Complete the next round through the same production transaction; the first test covers full form entry.
  const second = await row(request, 'cpp_findings', id);
  await rpc(request, 'cpp_complete_review', {
    p_finding: id,
    p_revision: second.revision,
    p_review: {
      ...body,
      recommendation: 'Closure ready',
      recommendation_reason:
        'Updated records and remaining limitations have been assessed and documented by the reviewer.',
      reviewer_conclusion:
        'Updated submission reviewed with the documented recommendation and limitations.',
    },
    p_request_id: crypto.randomUUID(),
    p_supersedes: null,
  });
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Submit for Final Approval', exact: true }),
  ).toBeEnabled();
  await confirm(page, 'Submit for Final Approval');
  await page.getByRole('button', { name: 'Confirm action', exact: true }).click();
  await page.getByRole('button', { name: 'Record approval decision', exact: true }).click();
  await page.getByLabel('Recorded by', { exact: true }).fill('Decision recorder');
  await page.getByLabel('Decision-maker name', { exact: true }).fill('External Auditor Avery');
  await page.getByLabel('Decision-maker organisation', { exact: true }).fill('Audit Firm');
  await page.getByLabel('Decision date', { exact: true }).fill('2026-01-02');
  await page
    .getByLabel('Decision reason', { exact: true })
    .fill('The updated assessment and supporting records are approved.');
  await page
    .getByLabel('Supporting decision reference / document link', { exact: true })
    .fill('AUD-REF-002');
  await page.getByRole('button', { name: 'Confirm action', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Approval approved', exact: true })).toBeVisible();
  expect((await row(request, 'cpp_findings', id)).lifecycle).toBe('closed');
  await page.getByText('Submission cycles and comparison', { exact: true }).click();
  await expect(page.getByText(/Corrects assessment:/)).toBeVisible();
  await expect(
    page.getByText('Cycle 2 · submitted by Reviewer Morgan', { exact: true }),
  ).toBeVisible();
  const zip = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download evidence pack', exact: true }).first().click();
  const file = await (await zip).path();
  const contents = unzipSync(new Uint8Array(await fs.readFile(file!)));
  expect(Object.keys(contents)).toContain('review-report.pdf');
  expect(JSON.parse(new TextDecoder().decode(contents['manifest.json'])).report_id).toBeTruthy();
  const closureDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report PDF', exact: true }).first().click();
  await (await closureDownload).saveAs(test.info().outputPath('closure-report.pdf'));
  await confirm(page, 'Reopen for follow-up');
  await page
    .getByLabel('Changes and response to requests', { exact: true })
    .fill('A further material change requires another review round.');
  await page.getByRole('button', { name: 'Confirm action', exact: true }).click();
  expect((await row(request, 'cpp_findings', id)).cycle_number).toBe(3);
  expect(errors).toEqual([]);
});
