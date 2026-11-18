import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi, beforeEach, expect, it } from 'vitest';
import { ManualChecklist } from './ManualReviewPages';
import type { ManualFinding } from '../lib/manual-api';
const { saveDraft, complete, refresh } = vi.hoisted(() => ({
  saveDraft: vi.fn(),
  complete: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('../app/WorkspaceProvider', () => ({ useWorkspace: () => ({ refresh }) }));
vi.mock('../lib/manual-api', () => ({ manualApi: { saveReview: saveDraft } }));
vi.mock('../lib/workflow-api', () => ({ workflowApi: { complete } }));
const finding = {
  id: 'finding',
  revision: 1,
  cycleNumber: 1,
  protocol: {
    code: 'access',
    title: 'Access review',
    version: 'test',
    checks: [
      { id: 'scope', label: 'Access scope', guidance: 'Inspect the scope', mandatory: true },
    ],
  },
  reviews: [],
  evidence: [],
} as unknown as ManualFinding;
beforeEach(() => {
  vi.clearAllMocks();
  saveDraft.mockResolvedValue('draft');
  refresh.mockResolvedValue(undefined);
  Element.prototype.scrollIntoView = vi.fn();
});
function show() {
  return render(
    <MemoryRouter>
      <ManualChecklist finding={finding} onSaved={async () => {}} />
    </MemoryRouter>,
  );
}
it('retains fields across steps and saves one draft with data from all three panels', async () => {
  const user = userEvent.setup();
  show();
  await user.type(screen.getByLabelText('Reviewer', { exact: true }), 'Reviewer Casey');
  await user.type(screen.getByLabelText('Access scope: rationale'), 'A specific checklist note.');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByLabelText('Reviewer', { exact: true })).not.toBeVisible();
  await user.selectOptions(
    screen.getByLabelText('Scope and evidence assessment'),
    'Gaps identified',
  );
  await user.type(
    screen.getByLabelText('Scope completeness judgement'),
    'Scope recorded on the judgement step.',
  );
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.type(
    screen.getByLabelText('Review conclusion and rationale'),
    'Recorded conclusion retained across steps.',
  );
  await user.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Scope completeness judgement')).toHaveValue(
    'Scope recorded on the judgement step.',
  );
  await user.click(screen.getByRole('button', { name: 'Save review draft' }));
  await waitFor(() => expect(saveDraft).toHaveBeenCalledOnce());
  const body = saveDraft.mock.calls[0][1];
  expect(body).toMatchObject({
    reviewer: 'Reviewer Casey',
    reviewer_conclusion: 'Recorded conclusion retained across steps.',
    review_step: 1,
    closure_judgement: { scope_conclusion: 'Scope recorded on the judgement step.' },
    checks: [
      {
        reason: 'A specific checklist note.',
        implementation_status: 'not_assessed',
        applicability: 'under_review',
      },
    ],
  });
  expect(complete).not.toHaveBeenCalled();
});
it('allows Next with untouched checks and routes a hidden required field back to its step on completion', async () => {
  const user = userEvent.setup();
  show();
  expect(screen.queryByRole('button', { name: 'Complete Review' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Complete Review' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Check the highlighted field');
  expect(screen.getByLabelText('Reviewer', { exact: true })).toBeVisible();
  const steps = screen.getByRole('navigation', { name: 'Review steps' });
  expect(within(steps).getByRole('button', { name: /Evidence & checklist/ })).toHaveAttribute(
    'aria-current',
    'step',
  );
  expect(complete).not.toHaveBeenCalled();
});
