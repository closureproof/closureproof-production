import {limitRequest} from '../../../../lib/server/request-limit';
import {readJsonBody,RequestBodyError} from '../../../../lib/server/request-body';
import { proposeReview } from '../../../../lib/server/ai-review-preparation';
import { sameRequestOrigin } from '../../../../lib/server/request-origin';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AnalysisError } from '../../../../lib/server/document-analysis';
import { completeUnrestrictedAssessment, completeAssessment, previewAssessment } from '../../../../lib/server/assessment-service';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
  const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
  try{
    if(!sameRequestOrigin(request))throw new AnalysisError('Use the assessment controls in the application.',403);
    const {action}=await params;
    if(!['evaluate','complete','propose','complete-unrestricted'].includes(action))return json({error:'Unknown assessment action.'},404);
    const body=await readJsonBody(request,8000000);
    await limitRequest(request,action==='propose'?'analysis-write':'assessment');
    return json(action==='complete-unrestricted'?await completeUnrestrictedAssessment(body):action==='propose'?await proposeReview(body):action==='evaluate'?await previewAssessment(body):await completeAssessment(body));
  }catch(error){return json({error:error instanceof AnalysisError||error instanceof RequestBodyError?error.message:error instanceof ZodError?'Assessment inputs do not match the protocol. Check dates, values and required fields.':'Assessment could not be completed. Your saved review remains available.'},error instanceof AnalysisError||error instanceof RequestBodyError?error.status:error instanceof ZodError?400:500);}
}
