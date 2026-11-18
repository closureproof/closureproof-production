import { limitRequest } from '../../../lib/server/request-limit';
import { readJsonBody, RequestBodyError } from '../../../lib/server/request-body';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DemoRequestError, saveDemoRequest } from '../../../lib/server/demo-requests';
import { sameRequestOrigin } from '../../../lib/server/request-origin';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(request: Request) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    if (!sameRequestOrigin(request))
      return json({ error: 'Submit this form from the ClosureProof website.' }, 403);
    const input = await readJsonBody(request, 8000);
    if (input && typeof input === 'object' && 'website' in input) {
      const { website, ...enquiry } = input as Record<string, unknown>;
      if (typeof website !== 'string' || website.length > 0)
        return json({ error: 'Unable to submit this enquiry.' }, 400);
      await limitRequest(request, 'demo');
      return json(await saveDemoRequest(enquiry), 201);
    }
    await limitRequest(request, 'demo');
    return json(await saveDemoRequest(input), 201);
  } catch (error) {
    return json(
      {
        error:
          error instanceof DemoRequestError || error instanceof RequestBodyError
            ? error.message
            : error instanceof ZodError
              ? 'Check your name, email, company and contact-person details.'
              : 'We could not confirm your request was saved. Please try again.',
      },
      error instanceof DemoRequestError || error instanceof RequestBodyError
        ? error.status
        : error instanceof ZodError
          ? 400
          : 503,
    );
  }
}
