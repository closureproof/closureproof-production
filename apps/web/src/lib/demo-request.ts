export interface DemoRequest {
  website?: string;
  name: string;
  email: string;
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
}
// The application server saves enquiries before notifying the administrator.
export async function submitDemoRequest(
  request: DemoRequest,
  requestId: string = crypto.randomUUID(),
): Promise<void> {
  const endpoint = '/api/demo-requests';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, requestId }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'Too many requests. Please try again later.'
        : 'We couldn’t send your demo request. Please try again.',
    );
  if (response.status === 204) return;
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('We couldn’t confirm your request was received. Please try again later.');
  const result = await response.json();
  if (result.accepted !== true)
    throw new Error('We couldn’t confirm your request was received. Please try again later.');
}
