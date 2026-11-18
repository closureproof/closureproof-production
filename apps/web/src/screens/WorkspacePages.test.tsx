import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi, beforeEach } from 'vitest';
import { OverviewPage } from './WorkspacePages';
import type { ManualFinding } from '../lib/manual-api';
const { workspace } = vi.hoisted(() => ({
  workspace: {
    manualFindings: [] as ManualFinding[],
    events: [],
    loading: false,
    error: '',
    role: 'admin',
  },
}));
vi.mock('../app/WorkspaceProvider', () => ({ useWorkspace: () => workspace }));
const finding = (readiness: ManualFinding['readiness'] = null) =>
  ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Actual submitted finding',
    owner: 'Control owner',
    severity: 'High',
    lifecycle: 'evidence_submitted',
    cycleNumber: 1,
    revision: 1,
    readiness,
    protocol: { title: 'Access review' },
  }) as ManualFinding;
beforeEach(() => {
  workspace.manualFindings = [];
  workspace.error = '';
  workspace.loading = false;
});
function show() {
  return render(
    <MemoryRouter>
      <OverviewPage />
    </MemoryRouter>,
  );
}
it('retains the original dashboard cards and table while showing a real unreviewed finding', () => {
  workspace.manualFindings = [finding()];
  show();
  expect(screen.getByRole('heading', { name: 'Closure overview' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Findings submitted/ })).toHaveTextContent('1');
  expect(screen.getByRole('link', { name: /^Ready for retest/ })).toHaveTextContent('0');
  expect(screen.getByRole('table')).toHaveTextContent('Actual submitted finding');
  expect(screen.getByRole('table')).toHaveTextContent('Awaiting review');
  expect(screen.queryByText(/CP-1042/)).not.toBeInTheDocument();
});
it('uses only the published reviewer recommendation for readiness counts', () => {
  workspace.manualFindings = [finding('Ready for retest')];
  show();
  expect(screen.getByRole('link', { name: /^Ready for retest/ })).toHaveTextContent('1');
  expect(screen.getByRole('link', { name: /^Ready for retest/ })).toHaveAttribute(
    'href',
    '/app/findings?readiness=Ready%20for%20retest',
  );
  expect(screen.getByRole('link', { name: /^Closure ready/ })).toHaveTextContent('0');
});
it('shows an empty workspace without invented findings', () => {
  show();
  expect(screen.getByRole('heading', { name: 'No findings submitted' })).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('does not display zero counts or sample records after a connection failure', () => {
  workspace.error = 'Network unavailable';
  show();
  expect(screen.getByRole('link', { name: /^Findings submitted/ })).toHaveTextContent('—');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
