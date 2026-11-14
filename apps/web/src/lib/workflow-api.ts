import { enginePost } from './rules-assessment';
import { getSupabase } from './supabase';
import { reviewFromRow, type ManualReview, type ReviewInput } from './manual-api';
export interface ReportRecord { id: string; assessment_id: string; finding_id: string; organisation_id: string; version: number; template_version: string; mode: 'assessment' | 'closure'; status: 'pending' | 'generating' | 'ready' | 'failed'; created_at: string; generated_at: string | null; object_path: string | null; sha256: string | null; byte_size: number | null; attempt: number; lease_token: string | null; lease_expires_at: string | null; last_error: string | null }
export interface Followup { id: string; assessment_id: string; cycle_number: number; kind: 'remediation' | 'retest'; status: string; data: Record<string,string>; response: Record<string,string> | null; created_at: string }
export interface ApprovalRequest { id: string; assessment_id: string; report_id: string; requested_by: string; status: string; created_at: string }
export interface ApprovalDecision { id: string; request_id: string; decision: string; data: Record<string,string>; created_at: string }
export interface ReviewCycle { id: string; number: number; submission_revision: number; submitted_by: string; change_summary: string; created_at: string }
export interface WorkflowData { reports: ReportRecord[]; followups: Followup[]; approvals: ApprovalRequest[]; decisions: ApprovalDecision[]; cycles: ReviewCycle[] }
export async function workflowRpc<T>(name: string, body: Record<string,unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(name,body);
  if(error && name === 'cpp_ai_extraction_version') throw new Error('Install 20261111000100_ai_document_extraction.sql before completing a review with extracted facts.');
  if(error && name === 'cpp_progressive_judgement_version') throw new Error('Install 20261109000400_conditional_judgement.sql in Supabase to enable conditional judgement fields.');
  if(error && name === 'cpp_judgement_schema_version') throw new Error('Install 20261109000300_simplified_reviewer_judgement.sql in the Supabase SQL Editor to enable the simplified judgement form.');
  if(error && name === 'cpp_repeat_remediation' && ['PGRST202','42883'].includes(error.code)) throw new Error('Install 20261114000100_repeat_remediation_requests.sql in Supabase before sending another remediation request.');
  if(error) throw new Error(['PGRST202','PGRST205','42P01'].includes(error.code) ? 'Install 20261109000100_review_completion_workflow.sql in the Supabase SQL Editor to enable the completion workflow.' : error.message);
  return data as T;
}
export const workflowApi = {
  repeatRemediation: (finding:string,revision:number,previous:string,data:Record<string,string>,request:string) => workflowRpc<string>('cpp_repeat_remediation',{p_finding:finding,p_revision:revision,p_previous:previous,p_data:data,p_request_id:request}),
  complete: async (finding: string, revision: number, review: ReviewInput, request: string, supersedes: string | null) => {
    if (review.ai_confirmation_ids?.length && await workflowRpc<string>('cpp_ai_extraction_version',{}) !== '1.0-openai-native') throw Error('Install the document-extraction migration before completing a review with adopted document facts.');
    if (review.closure_judgement?.version === '3.0-manual' && await workflowRpc<string>('cpp_progressive_judgement_version',{}) !== '3.0-manual') throw Error('Update the conditional judgement migration in Supabase before completing this review.');
    if (review.closure_judgement?.version === '2.0-manual' && await workflowRpc<string>('cpp_judgement_schema_version', {}) !== '2.0-manual') throw Error('Update the simplified reviewer judgement migration in Supabase before completing this review.');
    if (review.engine_request) return (await enginePost<{assessmentId:string}>('complete',{findingId:finding,revision,review,requestId:request,supersedes})).assessmentId;
    return workflowRpc<string>('cpp_complete_review',{p_finding:finding,p_revision:revision,p_review:review,p_request_id:request,p_supersedes:supersedes});
  },
  action: (finding: string, revision: number, assessment: string | null, action: string, data: Record<string,string>, request: string) => workflowRpc<string>('cpp_workflow_action',{p_finding:finding,p_revision:revision,p_assessment:assessment,p_action:action,p_data:data,p_request_id:request}),
  data: async (finding?: string): Promise<WorkflowData> => {
    const names=['cpp_reports','cpp_followups','cpp_approval_requests','cpp_approval_decisions','cpp_review_cycles'];
    const results=await Promise.all(names.map(name=>{let query=getSupabase().from(name).select('*');if(finding)query=query.eq('finding_id',finding);return query.order('created_at',{ascending:false});}));
    const error=results.find(result=>result.error)?.error;
    if(error) throw new Error(['PGRST205','42P01'].includes(error.code)?'Install 20261109000100_review_completion_workflow.sql in Supabase to enable reports and follow-up.':error.message);
    return {reports:results[0].data||[],followups:results[1].data||[],approvals:results[2].data||[],decisions:results[3].data||[],cycles:results[4].data||[]};
  },
  assessment: async (id:string): Promise<ManualReview & { organisation_snapshot?: {name:string} }> => {
    const {data,error}=await getSupabase().from('cpp_reviews').select('*').eq('id',id).single();
    if(error)throw error;
    if(data.status!=='completed')throw Error('Only completed assessments can generate reports.');
    return reviewFromRow(data,{revision:data.finding_revision});
  },
  report: async (id:string): Promise<ReportRecord> => {const {data,error}=await getSupabase().from('cpp_reports').select('*').eq('id',id).single();if(error)throw error;return data;},
};
