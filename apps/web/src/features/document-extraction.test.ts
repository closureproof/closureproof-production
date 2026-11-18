import { describe, it, expect } from 'vitest';
import {
  checkExtraction,
  confirmationSchema,
  DOCX_MIME,
  findingKeys,
} from '@closureproof/document-contracts';
const fields = () => Object.fromEntries(findingKeys.map((k) => [k, null]));
const reference = { quote: 'Access reviews were not completed.', locator: 'Finding 1', page: 2 };
describe('AI extraction contracts', () => {
  it('keeps missing facts null and requires citations for populated finding fields', () => {
    const value = {
      coverage: 'readable_text',
      limitations: [],
      findings: [
        {
          fields: { ...fields(), title: 'Access reviews', description: reference.quote },
          sources: [
            { field: 'title', ...reference },
            { field: 'description', ...reference },
          ],
        },
      ],
      facts: [],
    };
    const parsed = checkExtraction(value, 'report', 'application/pdf');
    expect(parsed.findings[0].fields.owner).toBeNull();
    expect(() =>
      checkExtraction(
        { ...value, findings: [{ ...value.findings[0], sources: [] }] },
        'report',
        'application/pdf',
      ),
    ).toThrow('source reference');
  });
  it('rejects invented DOCX page numbers and mixed output modes', () => {
    const value = {
      coverage: 'readable_text',
      limitations: [],
      findings: [],
      facts: [{ label: 'Population', value: '121 accounts', ...reference }],
    };
    expect(() => checkExtraction(value, 'evidence', DOCX_MIME)).toThrow('DOCX');
    expect(() => checkExtraction(value, 'report', 'application/pdf')).toThrow('wrong output');
  });
  it('does not allow unreadable material to return usable facts', () =>
    expect(() =>
      checkExtraction(
        {
          coverage: 'unreadable',
          limitations: ['No text'],
          findings: [],
          facts: [{ label: 'Population', value: '121', ...reference }],
        },
        'evidence',
        'application/pdf',
      ),
    ).toThrow('Unreadable'));
  it('requires source checking for confirmation and explanations for correction/rejection', () => {
    const base = {
      fact_index: 0,
      decision: 'confirmed',
      value: '121',
      actor: 'Casey',
      reason: '',
      source_checked: false,
    };
    expect(confirmationSchema.safeParse(base).success).toBe(false);
    expect(confirmationSchema.safeParse({ ...base, source_checked: true }).success).toBe(true);
    expect(
      confirmationSchema.safeParse({ ...base, decision: 'corrected', source_checked: true })
        .success,
    ).toBe(false);
    expect(
      confirmationSchema.safeParse({
        ...base,
        decision: 'rejected',
        reason: 'The quote is not supported by the original document.',
      }).success,
    ).toBe(true);
  });
});
