import { sameRequestOrigin } from './request-origin';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AnalysisError } from './document-analysis';
export function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function failure(error:unknown){return json({error:error instanceof AnalysisError?error.message:error instanceof ZodError?'The document request or AI output did not match the required structure.':'Document extraction could not be completed. Manual submission and review remain available.'},error instanceof AnalysisError?error.status:error instanceof ZodError?400:500);}
export async function input(request:Request){if(!sameRequestOrigin(request))throw new AnalysisError('Use the document controls in the application.',403);const raw=await request.text();if(raw.length>12000)throw new AnalysisError('Document request is too large.',413);try{return JSON.parse(raw);}catch{throw new AnalysisError('Invalid document request.');}}
