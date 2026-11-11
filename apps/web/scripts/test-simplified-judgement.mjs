import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;`);
const read=name=>fs.readFile(new URL('../../../supabase/migrations/'+name,import.meta.url),'utf8');
for(const name of ['20261106000200_public_pilot.sql','20261106000300_iso27001_checklists.sql','20261109000100_review_completion_workflow.sql'])await db.exec(await read(name));
const migration=await read('20261109000200_control_review_scopes.sql');
await db.exec(migration);await db.exec(migration);
let checks=0;
function assert(ok,message){if(!ok)throw Error(message);checks++;}
async function rpc(name,args=[]){return(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}
async function rejects(fn,message){try{await fn();}catch{checks++;return;}throw Error(message);}
const org='00000000-0000-4000-8000-000000000001';
const details={title:'Control scope verification',description:'The corrective action requires control-specific review.',owner:'IT owner',severity:'Medium',protocol_code:'access',account_reference:'Test environment',affected_systems:'Production',resources:'User register',approved_baseline:'Approved register',root_cause:'Review missed',recurrence_prevention:'Assign owner',corrective_action:'Reconcile register',implementation_date:null,deadline:null,control_reference:'AUD-001'};
const selection=(ids,extra={})=>({version:'1.0-control-scope',control_ids:ids,unknown_reason:'',additional_task_ids:[],excluded_tasks:{},additional_modules:[],excluded_modules:{},...extra});
const finding=async id=>(await db.query('select * from public.cpp_findings where id=$1',[id])).rows[0];
const complete=(id,rev,body,prior=null)=>rpc('cpp_complete_review',[id,rev,JSON.stringify(body),crypto.randomUUID(),prior]);
function review(f){const j={root_cause_type:'Missing process'};for(const [module,fields] of Object.entries({scope:['scope_conclusion','required_evidence','evidence_gaps'],cause:['cause_assessment','action_cause_assessment','recurrence_assessment'],exceptions:['exception_register','exception_judgement'],conclusion:['established_facts','remaining_actions','limitations_overrides'],population:['population_source','uncovered_items'],operation:['required_operating_period','operating_judgement'],retest:['retest_scope_method','retest_evidence_result']}))if(!f.protocol.review_scope||f.protocol.review_scope.modules.includes(module))for(const key of fields)j[key]='Review recorded with a documented rationale and evidence limitations.';if(!f.protocol.review_scope||f.protocol.review_scope.modules.includes('retest'))j.retest_status='Not performed';return {reviewer:'Review Person',reviewer_conclusion:'More evidence is required to support a closure recommendation.',scope_confirmed:true,scope_confirmation_notes:'Confirmed the custom scope and the reason for its limitations.',checks:f.protocol.checks.map(c=>({check_id:c.id,result:'unknown',applicability:'under_review',implementation_status:'not_assessed',reason:'The submitted material does not establish implementation.',evidence_ids:[],source_location:''})),closure_judgement:j,recommendation:'Not closure ready',recommendation_reason:'Implementation remains uncertain after inspection.',clarification_request:'Provide complete population and corrective action evidence.',exceptions_assessed:true,exception_entries:[]};}

const newMigration=await read('20261109000300_simplified_reviewer_judgement.sql');
await db.exec(newMigration);await db.exec(newMigration);
function simplified(f){const body=review(f);const j={...body.closure_judgement,version:'2.0-manual',coverage_approach:'Full population',retest_pending_actions:'Arrange the independent retest and supply the dated test record.'};delete j.recurrence_assessment;delete j.exception_register;delete j.retest_evidence_result;body.closure_judgement=j;return body;}
await db.exec('set role anon');
const id=await rpc('cpp_create_scoped_finding',[org,JSON.stringify(details),JSON.stringify(selection(['A.5.18']))]);
let f=await finding(id);let body=simplified(f);
await rejects(()=>complete(id,1,{...body,closure_judgement:{...body.closure_judgement,coverage_approach:''}}),'Coverage approach required');
await rejects(()=>complete(id,1,{...body,closure_judgement:{...body.closure_judgement,coverage_approach:'Sample'}}),'Sampling needs explanation');
await rejects(()=>complete(id,1,{...body,closure_judgement:{...body.closure_judgement,evidence_refs:{scope:[crypto.randomUUID()]}}}),'Invalid section evidence cannot be recorded');
const assessment=await complete(id,1,body);
const saved=(await db.query('select data from public.cpp_reviews where id=$1',[assessment])).rows[0].data;
assert(saved.closure_judgement.version==='2.0-manual'&&!saved.closure_judgement.recurrence_assessment&&!saved.closure_judgement.exception_register,'No duplicate narratives required for v2');
assert((await db.query('select status from public.cpp_reports where assessment_id=$1',[assessment])).rows[0].status==='pending','Simplified assessment still atomically requests report');
assert((await db.query('select template_version from public.cpp_reports where assessment_id=$1',[assessment])).rows[0].template_version==='1.1','New report template version is recorded');
const exceptionFinding=await rpc('cpp_create_scoped_finding',[org,JSON.stringify(details),JSON.stringify(selection(['A.5.18']))]);
f=await finding(exceptionFinding);body=simplified(f);
const entry={reference:'EX-01',description:'One outstanding account is outside the agreed removal window.',owner:'IT owner',disposition:'accepted',closure_impact:'Acceptance is documented for follow-up.',evidence_reference:'RISK-DECISION-1'};
await rejects(()=>complete(exceptionFinding,1,{...body,exception_entries:[entry]}),'Acceptance needs authority and supporting decision');
await rejects(()=>complete(exceptionFinding,1,{...body,exception_entries:[{...entry,disposition:'mitigated'}]}),'Mitigation needs compensating controls');
await rejects(()=>complete(exceptionFinding,1,{...body,exception_entries:[{...entry,disposition:'open'}],closure_judgement:{...body.closure_judgement,exception_judgement:''}}),'Exceptions need overall closure impact');
await complete(exceptionFinding,1,{...body,exception_entries:[{...entry,acceptance_authority:'Designated risk owner',acceptance_date:'2026-01-01',acceptance_reference:'DECISION-1'}]});checks++;
for(const status of ['Not performed','Planned','Not applicable — justification required','Completed']){
 const findingId=await rpc('cpp_create_scoped_finding',[org,JSON.stringify({...details,protocol_code:'backup'}),JSON.stringify(selection(['A.8.13']))]);
 const record=await finding(findingId);const input=simplified(record);const j=input.closure_judgement;j.retest_status=status;
 if(status==='Not applicable — justification required'){
  delete j.retest_scope_method;delete j.retest_pending_actions;
  await rejects(()=>complete(findingId,1,input),'Retest exclusion needs reason');
  j.retest_not_applicable_reason='The submitted issue is documentary and no technical retest is claimed.';
 }else if(status==='Completed'){
  delete j.retest_pending_actions;j.retester='Independent Tester';j.retest_date='2026-01-01';j.retest_result='The documented test confirmed the stated result within its limited scope.';
  await rejects(()=>complete(findingId,1,input),'Completed retest needs separate independence assessment');
  j.retest_independence='Tester was not involved in preparing the corrective action or source evidence.';
  await rejects(()=>complete(findingId,1,input),'Completed retest needs evidence reference');
  const upload=await rpc('cpp_begin_upload',[findingId,1,JSON.stringify({filename:'retest.txt',mime:'text/plain',size:10,sha256:'a'.repeat(64)}),JSON.stringify({evidence_type:'Retest record',source_system:'Test records',source_account:'Test environment',covered_resources:'Restore scope',description:'Dated independent retest record',submitted_by:'Tester',supersedes_id:null})]);
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('closureproof-pilot-evidence',$1,$2)",[upload.path,JSON.stringify({size:10,mimetype:'text/plain'})]);
  await rpc('cpp_finalize_upload',[upload.id,1]);j.retest_evidence_id=upload.id;j.evidence_refs={scope:[upload.id]};
  const latest=await finding(findingId);await complete(findingId,latest.revision,input);checks++;continue;
 }else{
  delete j.retest_pending_actions;await rejects(()=>complete(findingId,1,input),'Pending test needs outstanding work, not a fabricated result');
  j.retest_pending_actions='Arrange independent testing and submit a dated result with the scope and limitations.';
 }
 await complete(findingId,1,input);checks++;
}
const legacy=await rpc('cpp_create_finding',[org,JSON.stringify(details)]);const old=await finding(legacy);const legacyAssessment=await complete(legacy,1,review(old));
assert((await db.query('select data from public.cpp_reviews where id=$1',[legacyAssessment])).rows[0].data.closure_judgement.recurrence_assessment.length>0,'Legacy narrative schema remains readable and valid');
await db.exec('reset role');await db.exec(newMigration);
assert((await db.query('select data from public.cpp_reviews where id=$1',[assessment])).rows[0].data.closure_judgement.version==='2.0-manual','Rerun preserves completed snapshot');
await db.close();console.log(`Simplified reviewer judgement: ${checks} PostgreSQL assertions passed.`);
