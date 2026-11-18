import { vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { App } from '../test-support/LegacyRouterHarness';
function show(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
it('opens the dashboard directly without sign-in or dummy data', async () => {
  show('/app');
  expect(
    await screen.findByRole('navigation', { name: 'Workspace navigation' }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/CP-1042/)).not.toBeInTheDocument();
});
it('allows public findings navigation without exposing private records', async () => {
  show('/app/findings');
  expect(
    await screen.findByRole('navigation', { name: 'Workspace navigation' }),
  ).toBeInTheDocument();
});
it('keeps request-demo separate from workspace authentication', () => {
  show('/request-demo');
  expect(screen.getByRole('heading', { name: 'Request demo' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
});
it('does not use sample records when Supabase is unconfigured', async () => {
  show('/app');
  expect(
    await screen.findByRole('navigation', { name: 'Workspace navigation' }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/CP-1042/)).not.toBeInTheDocument();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function fillDemoForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Your name'), 'Jamie Test');
  await user.type(screen.getByLabelText('Your email'), 'jamie@example.test');
  await user.type(screen.getByLabelText('Company name'), 'Example Ltd');
  await user.type(screen.getByLabelText('Contact person’s name'), 'Taylor Contact');
  await user.type(
    screen.getByLabelText('Contact person’s email (optional)'),
    'taylor@example.test',
  );
  await user.type(screen.getByLabelText('Contact phone (optional)'), '+44 20 0000 0000');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Request demo' }));
}
it('redirects old login links directly to the public dashboard', async () => {
  show('/login');
  expect(await screen.findByRole('heading', { name: 'Closure overview' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
});
it('shows the full submission form without an account', async () => {
  show('/app/submission');
  expect(screen.queryByLabelText('Finding title')).not.toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: 'Enter finding manually' }));
  expect(await screen.findByLabelText('Finding title')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Create finding' })).toBeEnabled();
  expect(
    screen.queryByText(/current role cannot|uploads and saved reviews are unavailable/i),
  ).not.toBeInTheDocument();
});
it('keeps form details and reports unconfigured delivery without claiming success', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }),
      ),
  );
  show('/request-demo');
  await fillDemoForm();
  expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t send');
  expect(screen.getByLabelText('Your name')).toHaveValue('Jamie Test');
  expect(screen.queryByText('Request sent')).not.toBeInTheDocument();
});
it('sends all contact fields and shows success only after endpoint acceptance', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ accepted: true }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  show('/request-demo');
  await fillDemoForm();
  expect(await screen.findByText('Request sent')).toBeInTheDocument();
  expect(fetcher.mock.calls[0][0]).toBe('/api/demo-requests');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    website: '',
    requestId: expect.any(String),
    name: 'Jamie Test',
    email: 'jamie@example.test',
    companyName: 'Example Ltd',
    contactPerson: 'Taylor Contact',
    contactEmail: 'taylor@example.test',
    contactPhone: '+44 20 0000 0000',
  });
});
it('treats an HTML fallback as failure rather than a submitted demo request', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response('<html>fallback</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    ),
  );
  show('/request-demo');
  await fillDemoForm();
  expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t confirm');
  expect(screen.queryByText('Request sent')).not.toBeInTheDocument();
});

it.each(['/dashboard.html', '/preview', '/workbench'])(
  'retires the old workspace alias %s',
  async (path) => {
    show(path);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Workspace navigation' }),
    ).not.toBeInTheDocument();
  },
);
it('sends the public walkthrough to the enquiry form', async () => {
  const user = userEvent.setup();
  show('/');
  const walkthrough = screen.getByRole('link', { name: 'See how it works' });
  expect(walkthrough).toHaveAttribute('href', '/request-demo');
  await user.click(walkthrough);
  expect(await screen.findByRole('heading', { name: 'Request demo' })).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Explore the sample walkthrough' }),
  ).not.toBeInTheDocument();
});
