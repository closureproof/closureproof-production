import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { jsPDF } from 'jspdf';
const headers = { apikey: 'sb_publishable_test_only', 'Content-Type': 'application/json' };
for (const format of ['pdf', 'docx'])
  test(`original ${format} report opens in-app without losing review entries`, async ({
    page,
    request,
  }) => {
    const seeded = await request.post('http://127.0.0.1:54330/rest/v1/rpc/cpp_test_ai_evidence', {
      headers,
      data: {},
    });
    const run = await seeded.json();
    let bytes: Buffer;
    if (format === 'pdf') {
      const pdf = new jsPDF();
      pdf.text('Synthetic original audit report', 20, 20);
      bytes = Buffer.from(pdf.output('arraybuffer'));
    } else
      bytes = Buffer.from(
        zipSync({
          '[Content_Types].xml': strToU8(
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
          ),
          '_rels/.rels': strToU8(
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
          ),
          'word/document.xml': strToU8(
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetic original audit report</w:t></w:r></w:p></w:body></w:document>',
          ),
        }),
      );
    const filename = 'original-report.' + format,
      sha256 = createHash('sha256').update(bytes).digest('hex');
    await page.route('**/rest/v1/cpp_findings?*', async (route) => {
      const response = await route.fetch();
      const rows = await response.json();
      for (const row of Array.isArray(rows) ? rows : [rows])
        if (row.id === run.finding_id)
          row.details.source_report = {
            run_id: run.id,
            draft_index: 0,
            filename,
            sha256,
            confirmed_by: 'Submitter Taylor',
            confirmed_at: new Date().toISOString(),
            sources: [],
          };
      await route.fulfill({ response, json: rows });
    });
    await page.route('**/api/document-analysis/' + run.id + '/source', (route) =>
      route.fulfill({ json: { url: 'http://127.0.0.1:3006/preview-fixture', filename, sha256 } }),
    );
    await page.route('**/preview-fixture', (route) =>
      route.fulfill({
        body: bytes,
        contentType:
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.goto('/app/reviews/' + run.finding_id);
    await page.getByLabel('Reviewer', { exact: true }).fill('Reviewer unchanged');
    const open = page.getByRole('button', { name: 'Open original audit report', exact: true });
    await open.click();
    const panel = page.getByRole('complementary', { name: 'Original audit report preview' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Loading document…')).toHaveCount(0);
    await expect(panel.getByRole('link', { name: 'Download original', exact: true })).toBeVisible();
    if (format === 'docx')
      await expect(
        page
          .frameLocator('iframe[title="Original audit report document"]')
          .getByText('Synthetic original audit report', { exact: true }),
      ).toBeVisible();
    else await expect(panel.locator('iframe')).toHaveAttribute('src', /^blob:/);
    await page.screenshot({ path: test.info().outputPath('report-preview.png') });
    await panel.getByRole('button', { name: 'Close preview', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(open).toBeFocused();
    await expect(page.getByLabel('Reviewer', { exact: true })).toHaveValue('Reviewer unchanged');
    expect(downloads).toBe(0);
    await open.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    // Inspect remediation evidence through the same viewer, using original file bytes.
    const mime =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    await page.route('**/rest/v1/cpp_evidence?*', async (route) => {
      const response = await route.fetch();
      const rows = await response.json();
      for (const row of Array.isArray(rows) ? rows : [rows])
        if (row.id === run.evidence_id) {
          row.filename = filename;
          row.mime = mime;
          row.sha256 = sha256;
        }
      await route.fulfill({ response, json: rows });
    });
    await page.route('**/rest/v1/rpc/cpp_record_file_access', (route) =>
      route.fulfill({ json: { path: 'preview-evidence', filename, mime, sha256 } }),
    );
    await page.route('**/storage/v1/object/**', (route) =>
      route.fulfill({ body: bytes, contentType: mime }),
    );
    await page.reload();
    await page.getByLabel('Reviewer', { exact: true }).fill('Evidence reviewer unchanged');
    await page.getByRole('button', { name: 'Inspect evidence', exact: true }).click();
    const evidencePanel = page.getByRole('complementary', { name: 'Submitted evidence preview' });
    await expect(evidencePanel).toBeVisible();
    await expect(evidencePanel.getByText('Loading document…')).toHaveCount(0);
    if (format === 'docx')
      await expect(
        page
          .frameLocator('iframe[title="Submitted evidence document"]')
          .getByText('Synthetic original audit report', { exact: true }),
      ).toBeVisible();
    else await expect(evidencePanel.locator('iframe')).toHaveAttribute('src', /^blob:/);
    await evidencePanel.getByRole('button', { name: 'Close preview', exact: true }).click();
    await expect(page.getByLabel('Reviewer', { exact: true })).toHaveValue(
      'Evidence reviewer unchanged',
    );
    expect(downloads).toBe(0);
  });
