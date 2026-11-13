import { readJsonBody, RequestBodyError } from './request-body';
import { sameRequestOrigin } from './request-origin';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AnalysisError } from './document-analysis';
export function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function failure(error:unknown){return json({error:error instanceof AnalysisError||error instanceof RequestBodyError?error.message:error instanceof ZodError?'The document request or AI output did not match the required structure.':'Document extraction could not be completed. Manual submission and review remain available.'},error instanceof AnalysisError||error instanceof RequestBodyError?error.status:error instanceof ZodError?400:500);}
export async function input(request:Request){if(!sameRequestOrigin(request))throw new AnalysisError('Use the document controls in the application.',403);return readJsonBody(request,12000);}
