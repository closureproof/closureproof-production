import { vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { App } from './App';
function show(path: string) { return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); }
it('routes the public landing CTA to a labelled read-only demo', async () => {
  show('/'); await userEvent.click(screen.getByRole('link', { name: /See how it works/ }));
  expect(screen.getByRole('heading', { name: 'Is “complete” really complete?' })).toBeInTheDocument();
  expect(screen.getByText('Sample data · Read-only demo')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'New finding' })).not.toBeInTheDocument();
});
it('routes deferred app access to request demo without a sign-in form', () => {
  show('/app/findings'); expect(screen.getByRole('heading', { name: 'Request demo' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
});
it('filters sample findings and shows an empty state', async () => {
  show('/preview/findings'); await userEvent.type(screen.getByRole('textbox', { name: 'Search findings' }), 'does-not-exist');
  expect(screen.getByRole('heading', { name: 'No findings to show' })).toBeInTheDocument();
});
it('creates a local finding draft with no authoritative assessment', async () => {
  show('/preview/findings/new'); const user = userEvent.setup();
  await user.type(screen.getByLabelText('Finding title'), 'Review missing');
  await user.type(screen.getByLabelText('Description'), 'A review needs supporting evidence.');
  await user.type(screen.getByLabelText('ISO / control reference'), 'A.5.18');
  await user.type(screen.getByLabelText('Accountable owner'), 'Test owner');
  await user.type(screen.getByLabelText('Due date'), '2026-12-20');
  await user.type(screen.getByLabelText('Affected scope'), 'Test system');
  await user.click(screen.getByRole('button', { name: 'Save preview draft' }));
  expect(await screen.findByRole('heading', { name: 'Review missing' })).toBeInTheDocument();
  expect(screen.getByText('No server assessment has been run for this revision.')).toBeInTheDocument();
});
it('renders unknown assessment results with explanations', async () => {
  show('/dashboard.html/findings/CP-1042');
  await userEvent.click(screen.getByText('Evidence provenance'));
  expect(screen.getByText('Customer-submitted records have not been independently checked.')).toBeInTheDocument();
  expect(screen.getAllByText('Unknown')).toHaveLength(2);
});
it('labels all integrations as planned with no connect action', () => {
  show('/preview/integrations'); expect(screen.getAllByText('Planned integration')).toHaveLength(10);
  expect(screen.queryByRole('button', { name: /^Connect$/ })).not.toBeInTheDocument();
});
it('rejects unsupported evidence files', async () => {
  show('/preview/evidence'); const input = document.querySelector('input[type=file]') as HTMLInputElement;
  await userEvent.setup({ applyAccept: false }).upload(input, new File(['bad'], 'unsafe.exe', { type: 'application/octet-stream' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Unsupported format');
});
it('does not pretend that review submissions succeeded', async () => {
  show('/preview/findings/CP-1042'); const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: 'Review' }));
  await user.selectOptions(screen.getByLabelText('Retest result'), 'Passed');
  await user.type(screen.getByLabelText('Reviewer rationale'), 'Reviewed the full sample evidence and scope.');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Preview review submission' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Review was not submitted');
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function fillDemoForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Your name'), 'Jamie Test');
  await user.type(screen.getByLabelText('Your email'), 'jamie@example.test');
  await user.type(screen.getByLabelText('Company name'), 'Example Ltd');
  await user.type(screen.getByLabelText('Contact person’s name'), 'Taylor Contact');
  await user.type(screen.getByLabelText('Contact person’s email (optional)'), 'taylor@example.test');
  await user.type(screen.getByLabelText('Contact phone (optional)'), '+44 20 0000 0000');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Request demo' }));
}
it('shows a request-demo form instead of sign in from legacy login URLs', () => {
  show('/login'); expect(screen.getByRole('heading', { name: 'Request demo' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
});
it('keeps form details and reports unconfigured delivery without claiming success', async () => {
  vi.stubEnv('VITE_DEMO_REQUEST_URL', ''); show('/request-demo'); await fillDemoForm();
  expect(await screen.findByRole('alert')).toHaveTextContent('Your details have not been sent');
  expect(screen.getByLabelText('Your name')).toHaveValue('Jamie Test');
  expect(screen.queryByText('Demo request received')).not.toBeInTheDocument();
});
it('sends all contact fields and shows success only after endpoint acceptance', async () => {
  vi.stubEnv('VITE_DEMO_REQUEST_URL', 'https://example.test/demo');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 201, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher); show('/request-demo'); await fillDemoForm();
  expect(await screen.findByText('Demo request received')).toBeInTheDocument();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ name: 'Jamie Test', email: 'jamie@example.test', companyName: 'Example Ltd', contactPerson: 'Taylor Contact', contactEmail: 'taylor@example.test', contactPhone: '+44 20 0000 0000' });
});
it('treats an HTML fallback as failure rather than a submitted demo request', async () => {
  vi.stubEnv('VITE_DEMO_REQUEST_URL', 'https://example.test/demo');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>fallback</html>', { status: 200, headers: { 'content-type': 'text/html' } })));
  show('/request-demo'); await fillDemoForm();
  expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t confirm');
  expect(screen.queryByText('Demo request received')).not.toBeInTheDocument();
});
