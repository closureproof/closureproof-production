import { NextResponse } from 'next/server';
import { confirmFact, processRun, sourceUrl, publicRun, AnalysisError } from '../../../../../lib/server/document-analysis';
import { failure, input, json } from '../../../../../lib/server/analysis-http';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request,{params}:{params:Promise<{id:string;action:string}>}){try{const {id,action}=await params;const body=await input(request);if(action==='process')return json(publicRun(await processRun(id)));if(action==='confirm')return json(await confirmFact(id,body));throw new AnalysisError('Unknown document action.',404);}catch(error){return failure(error);}}
export async function GET(request:Request,{params}:{params:Promise<{id:string;action:string}>}){try{const {id,action}=await params;if(action!=='source')throw new AnalysisError('Unknown document action.',404);const source=await sourceUrl(id);return new URL(request.url).searchParams.has('download')?NextResponse.redirect(source.url):json(source);}catch(error){return failure(error);}}
