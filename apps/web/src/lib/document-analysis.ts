import {readApiResponse} from './api-response';
import { getSupabase } from './supabase';
import type { ScopeRequest } from '../features/control-scope';
import type { FindingInput } from './manual-api';
import type { AnalysisRun, FactConfirmation } from '@closureproof/document-contracts';
export type PublicAnalysisRun = Omit<AnalysisRun,'storage_path'>;
async function request<T>(path:string,body?:unknown):Promise<T>{const response=await fetch('/api/document-analysis'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});return readApiResponse<T>(response,'Document analysis');}
export const documentApi={
  list:(finding?:string)=>request<{runs:PublicAnalysisRun[]}>(''+(finding?'?finding='+encodeURIComponent(finding):'')),
  get:(id:string)=>request<PublicAnalysisRun>('/'+encodeURIComponent(id)),
  process:(id:string)=>request<PublicAnalysisRun>('/'+encodeURIComponent(id)+'/process',{}),
  source:(id:string)=>request<{url:string;filename:string;sha256:string}>('/'+encodeURIComponent(id)+'/source'),
  confirmMany:(id:string,confirmations:unknown[])=>request<{confirmations:FactConfirmation[]}>('/'+encodeURIComponent(id)+'/confirm-many',{confirmations}),
  confirm:(id:string,body:unknown)=>request<FactConfirmation>('/'+encodeURIComponent(id)+'/confirm',body),
  async report(file:File,requestId:string){
    const result=await request<{run:PublicAnalysisRun;upload:{path:string;token:string}|null}>('',{mode:'report',request_id:requestId,filename:file.name,byte_size:file.size});
    if(result.upload){const {error}=await getSupabase().storage.from('closureproof-pilot-evidence').uploadToSignedUrl(result.upload.path,result.upload.token,file,{contentType:result.run.mime,upsert:false});if(error)throw Error('The report could not be uploaded. Choose the original file again to retry.');}
    return result.run;
  },
  async evidence(finding:string,revision:number,evidence:string,requestId:string){return request<{run:PublicAnalysisRun}>('',{mode:'evidence',request_id:requestId,finding_id:finding,finding_revision:revision,evidence_id:evidence});},
  async createFinding(run:string,index:number,details:FindingInput,scope:ScopeRequest,actor:string){const {data,error}=await getSupabase().rpc('cpp_submit_extracted_finding',{p_run:run,p_index:index,p_details:details,p_scope:scope,p_actor:actor});if(error)throw Error(['PGRST202','42883'].includes(error.code)?'Install the document-extraction migration before submitting this draft.':error.message);return data as string;},
};
export const sourceHref=(id:string)=>'/api/document-analysis/'+encodeURIComponent(id)+'/source?download=1';
