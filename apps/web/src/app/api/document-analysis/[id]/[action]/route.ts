import {limitRequest} from '../../../../../lib/server/request-limit';
import { NextResponse } from 'next/server';
import { confirmFacts, confirmFact, processRun, sourceUrl, publicRun, AnalysisError } from '../../../../../lib/server/document-analysis';
import { failure, input, json } from '../../../../../lib/server/analysis-http';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request,{params}:{params:Promise<{id:string;action:string}>}){try{const {id,action}=await params;await limitRequest(request,action==='confirm'||action==='confirm-many'?'analysis-confirm':'analysis-write');const body=await input(request,action==='confirm-many'?200000:12000);if(action==='confirm-many')return json(await confirmFacts(id,body));if(action==='process')return json(publicRun(await processRun(id)));if(action==='confirm')return json(await confirmFact(id,body));throw new AnalysisError('Unknown document action.',404);}catch(error){return failure(error);}}
export async function GET(request:Request,{params}:{params:Promise<{id:string;action:string}>}){try{await limitRequest(request,'analysis-read');const {id,action}=await params;if(action!=='source')throw new AnalysisError('Unknown document action.',404);const source=await sourceUrl(id);return new URL(request.url).searchParams.has('download')?NextResponse.redirect(source.url):json(source);}catch(error){return failure(error);}}
