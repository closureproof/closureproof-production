import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated; grant select,insert,delete on storage.objects to anon,authenticated;`);
const read = name => fs.readFile(new URL('../../../supabase/migrations/'+name,import.meta.url),'utf8');
await db.exec(await read('20261106000200_public_pilot.sql'));
let checks=0;
function assert(ok,message){if(!ok)throw Error(message);checks++;}
async function rpc(name,args=[]){return(await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) value`,args)).rows[0].value;}
async function rejects(fn,message){try{await fn();}catch{checks++;return;}throw Error(message);}
await db.exec(await read('20261106000300_iso27001_checklists.sql'));
await db.exec(await read('20261109000100_review_completion_workflow.sql'));
await db.exec(await read('20261109000100_review_completion_workflow.sql'));

const org='00000000-0000-4000-8000-000000000001';
const input={title:'Completion workflow finding',description:'An incomplete access review requires further supporting evidence.',owner:'IT owner',severity:'Medium',protocol_code:'access',account_reference:'Test account',affected_systems:'Identity service',resources:'Users A and B',approved_baseline:'Approved register',root_cause:'Review missed',recurrence_prevention:'Assign ownership',corrective_action:'Review register',implementation_date:null,deadline:null,control_reference:'A.5.18'};
await db.exec('set role anon');
const id=await rpc('cpp_create_finding',[org,JSON.stringify(input)]);
const finding=(await db.query('select * from public.cpp_findings where id=$1',[id])).rows[0];
const judgement={root_cause_type:'Missing process',retest_status:'Not performed'};
for(const k of ['scope_conclusion','required_evidence','evidence_gaps','cause_assessment','action_cause_assessment','recurrence_assessment','population_source','uncovered_items','exception_register','exception_judgement','required_operating_period','operating_judgement','retest_scope_method','retest_evidence_result','established_facts','remaining_actions','limitations_overrides'])judgement[k]='Review recorded; further evidence is required for this finding.';
const body={reviewer:'Reviewer One',reviewer_conclusion:'Coverage is incomplete and additional source records are required.',publish:false,independent:false,independence_notes:'',checks:finding.protocol.checks.map(c=>({check_id:c.id,result:'unknown',applicability:'under_review',implementation_status:'not_assessed',reason:'Further evidence is needed for a complete assessment.',evidence_ids:[],source_location:''})),recommendation:'Not closure ready',recommendation_reason:'The reviewer identified incomplete coverage and implementation evidence.',next_status:'under_review',closure_judgement:judgement,population_expected:2,population_reviewed:1,exceptions_assessed:true,exception_entries:[],clarification_request:'Provide the missing account and corrective action evidence.'};
const key=crypto.randomUUID();
await rejects(()=>rpc('cpp_complete_review',[id,1,JSON.stringify({...body,reviewer_conclusion:''}),key,null]),'Missing conclusion rejected');
for(const patch of [
 {population_expected:1,population_reviewed:2},
 {checks:body.checks.map((c,i)=>i?c:{...c,evidence_ids:[crypto.randomUUID()]})},
 {checks:body.checks.map((c,i)=>i?c:{...c,reason:''})},
 {checks:body.checks.map((c,i)=>i?c:{...c,implementation_status:'implemented',applicability:'yes',result:'pass'})},
 {closure_judgement:{...judgement,operating_from:'2026-02-01',operating_to:'2026-01-01'}},
 {closure_judgement:{...judgement,operating_from:'2026-02-01'}},
 {closure_judgement:{...judgement,observed_cycles:'-1'}},
 {closure_judgement:{...judgement,retest_status:'Completed',retester:'Independent tester',retest_date:'2026-01-01',retest_evidence_id:crypto.randomUUID()}},
 {exceptions_assessed:false},
 {exception_entries:[{reference:'EX-1',owner:'IT',description:'Missing records',disposition:'resolved',closure_impact:'No outstanding issue'}]},
]) await rejects(()=>rpc('cpp_complete_review',[id,1,JSON.stringify({...body,...patch}),crypto.randomUUID(),null]),'Invalid completion fields rejected');
const assessment=await rpc('cpp_complete_review',[id,1,JSON.stringify(body),key,null]);
assert(await rpc('cpp_complete_review',[id,1,JSON.stringify(body),key,null])===assessment,'Completion retry idempotent');
await rejects(()=>rpc('cpp_complete_review',[id,1,JSON.stringify({...body,reviewer:'Other'}),key,null]),'Changed payload rejected');
await rejects(()=>rpc('cpp_complete_review',[id,1,JSON.stringify(body),crypto.randomUUID(),null]),'Second completion prevented');
assert((await db.query("select count(*) n from public.cpp_reviews where finding_id=$1 and status='completed'",[id])).rows[0].n===1,'One durable assessment');
assert((await db.query('select lifecycle from public.cpp_findings where id=$1',[id])).rows[0].lifecycle==='review_completed','Completion does not close finding');
assert((await db.query("select count(*) n from public.cpp_events where finding_id=$1 and title='Review completed'",[id])).rows[0].n===1,'One completion event');
await rejects(()=>rpc('cpp_save_review',[id,1,JSON.stringify({...body,publish:true})]),'Old publication route disabled');
const report=(await db.query('select * from public.cpp_reports where assessment_id=$1',[assessment])).rows[0];
assert(report.status==='pending','Report pending even for insufficient decision');
const lease=await rpc('cpp_begin_report',[report.id]);
await rejects(()=>rpc('cpp_begin_report',[report.id]),'Concurrent report generation prevented');
await rpc('cpp_fail_report',[report.id,lease.lease_token,'Example PDF failure']);
assert((await db.query('select status from public.cpp_reviews where id=$1',[assessment])).rows[0].status==='completed','PDF failure retains decision');
const retried=await rpc('cpp_begin_report',[report.id]);
assert(retried.attempt===2,'Report retry increments attempt');
await rejects(()=>rpc('cpp_finish_report',[report.id,retried.lease_token,'a'.repeat(64),50]),'Absent upload rejected');
await db.query("insert into storage.objects(bucket_id,name,metadata) values('closureproof-pilot-evidence',$1,$2)",[retried.object_path,JSON.stringify({size:50,mimetype:'application/pdf'})]);
await rpc('cpp_finish_report',[report.id,retried.lease_token,'a'.repeat(64),50]);
assert((await db.query('select status from public.cpp_reports where id=$1',[report.id])).rows[0].status==='ready','Report finalised');
await rejects(()=>db.query('delete from storage.objects where name=$1 returning id',[retried.object_path]).then(r=>{if(!r.rows.length)throw Error('protected');}),'Ready report protected');
const command=crypto.randomUUID();const followup={actor:'Reviewer One',owner:'IT owner',requested_actions:'Complete the missing access review.',evidence_requirements:'Provide the full register and action record.'};
const followId=await rpc('cpp_workflow_action',[id,1,assessment,'return_remediation',JSON.stringify(followup),command]);
assert(await rpc('cpp_workflow_action',[id,1,assessment,'return_remediation',JSON.stringify(followup),command])===followId,'Follow-up idempotent');
await rpc('cpp_update_finding',[id,1,JSON.stringify({...input,corrective_action:'Full access register now reviewed'})]);
assert((await db.query('select lifecycle from public.cpp_findings where id=$1',[id])).rows[0].lifecycle==='changes_requested','Material update preserves follow-up state');
await rejects(()=>rpc('cpp_complete_review',[id,2,JSON.stringify(body),crypto.randomUUID(),null]),'Changed submission needs next cycle');
await rpc('cpp_workflow_action',[id,2,assessment,'resubmit',JSON.stringify({actor:'IT owner',change_summary:'Corrective action updated; source records resubmitted.'}),crypto.randomUUID()]);
const resub=(await db.query('select * from public.cpp_findings where id=$1',[id])).rows[0];
assert(resub.cycle_number===2&&resub.revision===3,'Resubmission creates cycle and revision');
assert((await db.query('select status from public.cpp_followups where id=$1',[followId])).rows[0].status==='responded','Request response retained');
const draft=await rpc('cpp_save_review',[id,3,JSON.stringify(body)]);
assert((await db.query('select cycle_number from public.cpp_reviews where id=$1',[draft])).rows[0].cycle_number===2,'Draft is associated with current submission cycle');
const second=await rpc('cpp_complete_review',[id,3,JSON.stringify({...body,recommendation:'Ready for retest'}),crypto.randomUUID(),null]);
await rpc('cpp_workflow_action',[id,3,second,'request_retest',JSON.stringify(followup),crypto.randomUUID()]);
assert((await db.query('select lifecycle from public.cpp_findings where id=$1',[id])).rows[0].lifecycle==='retest_pending','Retest not treated as failure');
await rpc('cpp_workflow_action',[id,3,second,'resubmit',JSON.stringify({actor:'IT owner',change_summary:'Retest information supplied for reassessment.'}),crypto.randomUUID()]);
const thirdBody={...body,recommendation:'Closure ready',closure_judgement:{...judgement,closure_ready_acknowledged:true}};
const third=await rpc('cpp_complete_review',[id,4,JSON.stringify(thirdBody),crypto.randomUUID(),null]);
await rejects(()=>rpc('cpp_workflow_action',[id,4,third,'submit_approval',JSON.stringify({actor:'Reviewer One'}),crypto.randomUUID()]),'Approval waits for report');
const r3=(await db.query('select * from public.cpp_reports where assessment_id=$1',[third])).rows[0];
const l3=await rpc('cpp_begin_report',[r3.id]);await db.query("insert into storage.objects(bucket_id,name,metadata) values('closureproof-pilot-evidence',$1,$2)",[l3.object_path,JSON.stringify({size:50,mimetype:'application/pdf'})]);await rpc('cpp_finish_report',[r3.id,l3.lease_token,'b'.repeat(64),50]);
const approval=await rpc('cpp_workflow_action',[id,4,third,'submit_approval',JSON.stringify({actor:'Reviewer One'}),crypto.randomUUID()]);
assert((await db.query('select lifecycle from public.cpp_findings where id=$1',[id])).rows[0].lifecycle==='awaiting_final_approval','Closure ready is not closed');
const decision={actor:'Decision recorder',decision:'approved',decision_maker:'External Auditor',organisation:'Audit firm',capacity:'External auditor',decision_reference:'AUDIT-DECISION-001',reason:'The submitted closure evidence has been approved.',decision_date:'2026-01-01'};
const approved=await rpc('cpp_workflow_action',[id,4,third,'record_approval',JSON.stringify(decision),crypto.randomUUID()]);
assert((await db.query('select lifecycle from public.cpp_findings where id=$1',[id])).rows[0].lifecycle==='closed','Recorded approval closes finding');
const saved=(await db.query('select * from public.cpp_approval_decisions where id=$1',[approved])).rows[0];assert(saved.data.actor!==saved.data.decision_maker,'Recorder separate from decision-maker');
await rejects(()=>rpc('cpp_update_finding',[id,4,JSON.stringify(input)]),'Closed finding edit prevented');
await rpc('cpp_workflow_action',[id,4,third,'reopen',JSON.stringify({actor:'IT owner',change_summary:'Reopened for follow-up after another change.'}),crypto.randomUUID()]);
assert((await db.query('select cycle_number from public.cpp_findings where id=$1',[id])).rows[0].cycle_number===4,'Reopening preserves history and creates cycle');
// Corrections append snapshots; rejection and stale approvals cannot close a case.
const correctionFinding=await rpc('cpp_create_finding',[org,JSON.stringify({...input,title:'Assessment correction and approval rejection'})]);
const original=await rpc('cpp_complete_review',[correctionFinding,1,JSON.stringify(body),crypto.randomUUID(),null]);
const correction=await rpc('cpp_complete_review',[correctionFinding,1,JSON.stringify({...thirdBody,reviewer_conclusion:'Corrected recommendation after revisiting the documented observations.'}),crypto.randomUUID(),original]);
const corrected=(await db.query('select * from public.cpp_reviews where id=$1',[correction])).rows[0];
assert(corrected.supersedes_id===original&&corrected.assessment_revision===2,'Correction links immutable prior assessment');
await rejects(()=>rpc('cpp_complete_review',[correctionFinding,1,JSON.stringify(body),crypto.randomUUID(),original]),'Correction must reference latest assessment');
async function readyReport(assessmentId){const r=(await db.query('select * from public.cpp_reports where assessment_id=$1',[assessmentId])).rows[0];const l=await rpc('cpp_begin_report',[r.id]);await db.query("insert into storage.objects(bucket_id,name,metadata) values('closureproof-pilot-evidence',$1,$2)",[l.object_path,JSON.stringify({size:50,mimetype:'application/pdf'})]);return rpc('cpp_finish_report',[r.id,l.lease_token,'c'.repeat(64),50]);}
await readyReport(correction);
await rejects(()=>rpc('cpp_workflow_action',[correctionFinding,1,original,'submit_approval',JSON.stringify({actor:'Reviewer'}),crypto.randomUUID()]),'Superseded assessment cannot request approval');
await rpc('cpp_workflow_action',[correctionFinding,1,correction,'submit_approval',JSON.stringify({actor:'Reviewer'}),crypto.randomUUID()]);
const rejection={...decision,...followup,decision:'rejected',reason:'Additional evidence requested before the documented decision can be approved.'};
await rpc('cpp_workflow_action',[correctionFinding,1,correction,'record_approval',JSON.stringify(rejection),crypto.randomUUID()]);
assert((await db.query('select lifecycle from public.cpp_findings where id=$1',[correctionFinding])).rows[0].lifecycle==='changes_requested','Rejection returns for follow-up without closure');
await rejects(()=>rpc('cpp_complete_review',[correctionFinding,1,JSON.stringify(thirdBody),crypto.randomUUID(),correction]),'Rejected approval requires a new submission cycle');
await rpc('cpp_workflow_action',[correctionFinding,1,correction,'resubmit',JSON.stringify({actor:'IT owner',change_summary:'Supplied additional evidence requested by the approver.'}),crypto.randomUUID()]);
const incomplete=await rpc('cpp_complete_review',[correctionFinding,2,JSON.stringify({...body,recommendation:'Implemented but evidence incomplete'}),crypto.randomUUID(),null]);
assert((await db.query('select mode from public.cpp_reports where assessment_id=$1',[incomplete])).rows[0].mode==='assessment','Incomplete evidence gets assessment report');
await rpc('cpp_workflow_action',[correctionFinding,2,incomplete,'return_remediation',JSON.stringify(followup),crypto.randomUUID()]);
await rpc('cpp_workflow_action',[correctionFinding,2,incomplete,'resubmit',JSON.stringify({actor:'IT owner',change_summary:'New records submitted for the next review.'}),crypto.randomUUID()]);
const current=await rpc('cpp_complete_review',[correctionFinding,3,JSON.stringify(thirdBody),crypto.randomUUID(),null]);
await readyReport(current);
const pending=await rpc('cpp_workflow_action',[correctionFinding,3,current,'submit_approval',JSON.stringify({actor:'Reviewer'}),crypto.randomUUID()]);
await rpc('cpp_update_finding',[correctionFinding,3,JSON.stringify({...input,title:'Materially changed after approval request'})]);
assert((await db.query('select status from public.cpp_approval_requests where id=$1',[pending])).rows[0].status==='invalidated','Material change invalidates pending approval');
await rejects(()=>rpc('cpp_workflow_action',[correctionFinding,4,current,'record_approval',JSON.stringify(decision),crypto.randomUUID()]),'Stale assessment cannot formally close changed finding');
assert((await db.query('select data from public.cpp_reviews where id=$1',[original])).rows[0].data.recommendation==='Not closure ready','Original recommendation survives all later changes');
await db.exec('reset role');
await rejects(()=>db.query("update public.cpp_reviews set reviewer_name='Rewritten' where id=$1",[assessment]),'Completed assessment immutable even via direct update');
await rejects(()=>db.query("delete from public.cpp_approval_decisions where id=$1",[approved]),'Approval decision immutable');
assert((await db.query("select count(*) n from public.cpp_reviews where finding_id=$1 and status='completed'",[id])).rows[0].n===3,'Previous assessments retained');
await db.close();console.log(`Review completion workflow: ${checks} PostgreSQL assertions passed.`);
