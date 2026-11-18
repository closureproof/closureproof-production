import { expect, it } from 'vitest';
import {
  assessmentMethod,
  newProtocolDraft,
} from '@closureproof/assessment-engine/protocol-catalogue';
import { assessmentSourceIssue, assessmentSourceMessage } from './assessment-source-validation';
const fields = assessmentMethod('aws-iam')!.fields;
it('identifies the exact missing sources for an established answer', () => {
  const draft = newProtocolDraft('aws-iam');
  draft.entries.scope = { value: 'true', basis: '', locator: '', evidenceIds: [] };
  const issue = assessmentSourceIssue(fields, draft, ['file'])!;
  expect(issue).toMatchObject({ fieldId: 'scope', missing: ['basis', 'locator', 'evidence'] });
  expect(assessmentSourceMessage(issue, true)).toContain('Shared assessment basis');
  expect(assessmentSourceMessage(issue, true)).toContain('Shared supporting evidence');
});
it('accepts source-backed answers without inventing missing facts', () => {
  const draft = newProtocolDraft('aws-iam');
  draft.entries.scope = {
    value: 'true',
    basis: 'Inspected the approved baseline and population.',
    locator: 'Section 1',
    evidenceIds: ['file'],
  };
  expect(assessmentSourceIssue(fields, draft, ['file'])).toBeNull();
  expect(draft.entries.cause).toBeUndefined();
});
it('leaves unknown facts for the engine and ignores explicitly inactive timing entries', () => {
  const draft = newProtocolDraft('aws-iam');
  draft.entries.scope = { value: 'unknown', basis: '', locator: '', evidenceIds: [] };
  draft.entries.operation_required = {
    value: 'false',
    basis: 'Operating history is not required for this correction.',
    locator: 'Decision 1',
    evidenceIds: ['file'],
  };
  draft.entries.operation_start = { value: '2026-11-01', basis: '', locator: '', evidenceIds: [] };
  expect(assessmentSourceIssue(fields, draft, ['file'])).toBeNull();
});
it('identifies replaced or duplicate evidence links before evaluation', () => {
  const draft = newProtocolDraft('aws-iam');
  draft.entries.scope = {
    value: 'true',
    basis: 'The reviewer recorded the supporting baseline.',
    locator: 'Section 1',
    evidenceIds: ['replaced'],
  };
  expect(assessmentSourceIssue(fields, draft, ['current'])?.missing).toEqual(['evidence']);
  draft.entries.scope.evidenceIds = ['current', 'current'];
  expect(assessmentSourceIssue(fields, draft, ['current'])?.missing).toEqual(['evidence']);
});
