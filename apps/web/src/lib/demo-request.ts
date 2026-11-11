export interface DemoRequest {
  name: string;
  email: string;
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
}
// A public lead-intake endpoint must be configured before requests can be sent.
// No details are stored in browser storage or submitted to workspace APIs.
export async function submitDemoRequest(request: DemoRequest): Promise<void> {
  const endpoint = process.env.NEXT_PUBLIC_DEMO_REQUEST_URL;
  if (!endpoint) throw new Error('Demo requests aren’t available just yet. Your details have not been sent. Please try again later.');
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('We couldn’t send your demo request. Please try again.');
  if (response.status === 204) return;
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('We couldn’t confirm your request was received. Please try again later.');
  const result = await response.json();
  if (result.accepted !== true) throw new Error('We couldn’t confirm your request was received. Please try again later.');
}
