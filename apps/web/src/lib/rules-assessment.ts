import {readApiResponse} from './api-response';
import type { AssessmentInput, Evaluation, Protocol } from '@closureproof/assessment-engine';
import type { EngineDraft } from '@closureproof/assessment-engine/aws-iam';
import type { Readiness } from './types';
export interface EnginePreview { input: AssessmentInput; evaluation: Evaluation; protocolHash: string; evaluationHash: string; validationStatus: 'candidate' }
export interface EngineRequest { draft: EngineDraft; evaluationHash: string; disposition: 'accept'|'override'|''; overrideReason: string; overrideEvidenceIds: string[] }
export interface RulesSnapshot extends EnginePreview { protocol: {code:string;version:string}; protocolDefinition: Protocol; disposition: 'accept'|'override'; overrideReason: string; overrideEvidenceIds: string[]; recordedRecommendation: Readiness; reviewer: string }
export async function enginePost<T>(action:'evaluate'|'complete'|'propose',body:unknown):Promise<T>{
  const response=await fetch('/api/assessments/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  return readApiResponse<T>(response,action==='propose'?'Review preparation':action==='complete'?'Review completion':'Readiness evaluation');
}
