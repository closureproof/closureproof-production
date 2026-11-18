import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ManualFinding } from '../lib/manual-api';
vi.mock('../app/WorkspaceProvider', () => ({ useWorkspace: () => ({ refresh: vi.fn() }) }));
vi.mock('../lib/workflow-api', () => ({
  workflowApi: {
    data: vi.fn(async () => ({
      reports: [],
      followups: [],
      approvals: [],
      decisions: [],
      cycles: [],
    })),
    action: vi.fn(async () => 'request-id'),
  },
}));
vi.mock('../lib/report-generation', () => ({
  generateReport: vi.fn(),
  downloadReport: vi.fn(),
  downloadPack: vi.fn(),
  reportTitle: vi.fn(),
}));
import { ReviewWorkflow } from './ReviewWorkflow';
it('lets a current not-ready finding request remediation when its state has no follow-up record', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const finding = {
    id: 'finding',
    revision: 2,
    cycleNumber: 1,
    lifecycle: 'changes_requested',
    reviews: [
      {
        id: 'assessment',
        status: 'completed',
        cycleNumber: 1,
        assessmentRevision: 1,
        stale: false,
        createdAt: '2026-11-14T12:00:00Z',
        reviewer: 'Reviewer',
        recommendation: 'Not closure ready',
        reviewer_conclusion: 'More evidence required.',
      },
    ],
  } as ManualFinding;
  render(<ReviewWorkflow finding={finding} reviewer onSaved={vi.fn(async () => {})} />);
  const button = await screen.findByRole('button', { name: 'Request remediation' });
  await vi.waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(screen.getByLabelText('Request type')).toBeVisible();
  expect(screen.getByLabelText('Evidence required')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Resubmit for Review' })).not.toBeInTheDocument();
});
