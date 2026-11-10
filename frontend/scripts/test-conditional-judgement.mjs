import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;`);
const read=name=>fs.readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
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

const progressiveMigration=await read('20261109000400_conditional_judgement.sql');
await db.exec(progressiveMigration);await db.exec(progressiveMigration);
function compact(f,patch={}){const body=simplified(f);body.closure_judgement={...body.closure_judgement,version:'3.0-manual',scope_status:'Sufficient for this finding',cause_status:'Supported',population_requirement:'Not required',population_requirement_reason:'Single documentary scope; a population review is not needed.',operation_requirement:'Not required',operation_requirement_reason:'The change does not make a repeated-operation effectiveness claim.',retest_requirement:'Not required',retest_requirement_reason:'The finding requires document inspection rather than an independent technical test.',exceptions_status:'None identified',followup_status:'Required',limitations_status:'Identified',...patch};return body;}
async function create(){return rpc('cpp_create_scoped_finding',[org,JSON.stringify({...details,protocol_code:'backup'}),JSON.stringify(selection(['A.8.13']))]);}
await db.exec('set role anon');
assert(await rpc('cpp_judgement_schema_version')==='2.0-manual','Existing client capability check remains compatible');
assert(await rpc('cpp_progressive_judgement_version')==='3.0-manual','New capability installed');
let id=await create();let f=await finding(id);let body=compact(f);
for(const key of ['scope_conclusion','required_evidence','evidence_gaps','root_cause_type','cause_assessment','action_cause_assessment','population_source','required_operating_period','retest_scope_method','retest_pending_actions'])delete body.closure_judgement[key];
for(const patch of [{scope_status:''},{cause_status:''},{population_requirement:''},{population_requirement_reason:''},{retest_requirement:'Not yet established',retest_requirement_reason:''},{exceptions_status:''},{followup_status:''},{limitations_status:''}])await rejects(()=>complete(id,1,{...body,closure_judgement:{...body.closure_judgement,...patch}}),'Explicit reviewer decisions/reasons required');
const assessment=await complete(id,1,body);
let snapshot=(await db.query('select data from public.cpp_reviews where id=$1',[assessment])).rows[0].data;
assert(snapshot.closure_judgement.retest_requirement==='Not required'&&!snapshot.closure_judgement.retest_status,'No invented test status for a waived retest');
assert(!snapshot.closure_judgement.required_operating_period&&!snapshot.closure_judgement.population_source,'Inactive detail fields are not required or stored');
assert(snapshot.checks.every(c=>c.implementation_status==='not_assessed'&&c.applicability==='under_review'),'Control statuses remain untouched');
assert((await db.query('select template_version from public.cpp_reports where assessment_id=$1',[assessment])).rows[0].template_version==='1.2','Progressive report template recorded');
id=await create();f=await finding(id);body=compact(f,{scope_status:'Not yet established',cause_status:'Not yet established',population_requirement:'Not yet established',operation_requirement:'Not yet established',retest_requirement:'Not yet established',exceptions_status:'Not yet established',exceptions_status_reason:'The exception register is missing; obtain and inspect it before establishing exposure.'});body.exceptions_assessed=false;
const unknown=await complete(id,1,body);snapshot=(await db.query('select data from public.cpp_reviews where id=$1',[unknown])).rows[0].data;
assert(snapshot.closure_judgement.exceptions_status==='Not yet established'&&!snapshot.exceptions_assessed,'Unknown exceptions are not reported as none');
assert(snapshot.closure_judgement.retest_requirement==='Not yet established'&&!snapshot.closure_judgement.retester,'Unknown retest remains explicitly outstanding');
id=await create();f=await finding(id);body=compact(f,{population_requirement:'Required',coverage_approach:'Sample'});
await rejects(()=>complete(id,1,body),'Sample still needs a sampling method');
body.closure_judgement.sampling_basis='Sample selected by resource type and owner; coverage limitations are recorded.';
await complete(id,1,body);checks++;
id=await create();f=await finding(id);body=compact(f,{operation_requirement:'Required',operating_from:'2026-02-01',operating_to:'2026-01-01'});
await rejects(()=>complete(id,1,body),'Required operating history enforces dates');
body.closure_judgement.operation_requirement='Not required';
const inactive=await complete(id,1,body);snapshot=(await db.query('select data from public.cpp_reviews where id=$1',[inactive])).rows[0].data;
assert(!snapshot.closure_judgement.operating_from,'A waived review drops stale hidden dates');
id=await create();f=await finding(id);body=compact(f,{retest_requirement:'Required',retest_status:'Completed'});
await rejects(()=>complete(id,1,body),'Required completed retest needs result, independence and evidence');
body.closure_judgement.retest_requirement='Not required';
const waiver=await complete(id,1,body);snapshot=(await db.query('select data from public.cpp_reviews where id=$1',[waiver])).rows[0].data;
assert(!snapshot.closure_judgement.retest_status,'Stale completed test status cannot survive a waiver');
id=await create();f=await finding(id);body=compact(f);body.recommendation='Ready for retest';
await rejects(()=>complete(id,1,body),'Ready for retest needs an explicit required decision');
body.recommendation='Not closure ready';body.exception_entries=[{reference:'EX-1',description:'Outstanding exception',owner:'IT owner',disposition:'open',closure_impact:'Requires follow-up evidence'}];
await rejects(()=>complete(id,1,body),'None identified cannot carry hidden exception entries');
body.closure_judgement.exceptions_status='Exceptions identified';body.exception_entries[0].disposition='accepted';body.exception_entries[0].evidence_reference='DEC-1';
await rejects(()=>complete(id,1,body),'Accepted exceptions still require decision authority');
id=await create();f=await finding(id);body=compact(f,{evidence_refs:{scope:[crypto.randomUUID()]}});
await rejects(()=>complete(id,1,body),'New schema validates evidence references');
id=await create();f=await finding(id);await complete(id,1,simplified(f));checks++;
id=await create();f=await finding(id);await rejects(()=>complete(id,1,{...review(f),exceptions_assessed:false}),'Legacy exception declaration is still mandatory');await complete(id,1,review(f));checks++;
await db.exec('reset role');await db.exec(progressiveMigration);
assert((await db.query('select data from public.cpp_reviews where id=$1',[assessment])).rows[0].data.closure_judgement.version==='3.0-manual','Rerun preserves completed snapshot');
await db.close();console.log(`Conditional reviewer judgement: ${checks} PostgreSQL assertions passed.`);
