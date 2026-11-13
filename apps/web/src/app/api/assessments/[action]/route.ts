import { proposeReview } from '../../../../lib/server/ai-review-preparation';
import { sameRequestOrigin } from '../../../../lib/server/request-origin';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AnalysisError } from '../../../../lib/server/document-analysis';
import { completeAssessment, previewAssessment } from '../../../../lib/server/assessment-service';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
  const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
  try{
    if(!sameRequestOrigin(request))throw new AnalysisError('Use the assessment controls in the application.',403);
    const {action}=await params;
    if(!['evaluate','complete','propose'].includes(action))return json({error:'Unknown assessment action.'},404);
    const raw=await request.text();if(raw.length>180000)throw new AnalysisError('Assessment request is too large.',413);
    let body:unknown;try{body=JSON.parse(raw);}catch{throw new AnalysisError('Invalid assessment request.');}
    return json(action==='propose'?await proposeReview(body):action==='evaluate'?await previewAssessment(body):await completeAssessment(body));
  }catch(error){return json({error:error instanceof AnalysisError?error.message:error instanceof ZodError?'Assessment inputs do not match the protocol. Check dates, values and required fields.':'Assessment could not be completed. Your saved review remains available.'},error instanceof AnalysisError?error.status:error instanceof ZodError?400:500);}
}
