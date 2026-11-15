process.on('uncaughtException',error=>{console.error({message:error.message,code:error.code,where:error.where});process.exit(1);});
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;`);
const read=name=>fs.readFile(new URL('../../../supabase/migrations/'+name,import.meta.url),'utf8');
for(const name of ['20261106000200_public_pilot.sql','20261106000300_iso27001_checklists.sql','20261109000100_review_completion_workflow.sql','20261109000200_control_review_scopes.sql','20261109000300_simplified_reviewer_judgement.sql','20261109000400_conditional_judgement.sql'])await db.exec(await read(name));
const migration=await read('20261111000100_ai_document_extraction.sql');await db.exec(migration);await db.exec(migration);
await db.exec(await read('20261111000500_ai_review_preparation.sql'));
const expanded=await read('20261114000200_multi_document_review.sql');await db.exec(expanded);await db.exec(expanded);
let checks=0;function assert(ok,message){if(!ok)throw Error(message);checks++;}
async function rejects(fn,message){try{await fn();}catch{checks++;return;}throw Error(message);}
async function rpc(name,args=[]){return(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}

await db.exec(await read('20261115000100_unrestricted_review_completion.sql'));
await db.exec(await read('20261115000100_unrestricted_review_completion.sql'));
const details={title:'Temporary completion check',description:'Incomplete evidence for assessment',owner:'Team',severity:'Medium',protocol_code:'access',account_reference:'Test',affected_systems:'Test',resources:'Test',approved_baseline:'',root_cause:'',corrective_action:'',recurrence_prevention:''};
const scope={version:'1.0-control-scope',control_ids:['A.5.18'],unknown_reason:'',additional_task_ids:[],excluded_tasks:{},additional_modules:[],excluded_modules:{}};
await db.exec('set role anon');const fid=await rpc('cpp_create_scoped_finding',['00000000-0000-4000-8000-000000000001',JSON.stringify(details),JSON.stringify(scope)]);
const request=crypto.randomUUID(),body={reviewer:'Casey',recommendation:'Closure ready',checks:[],closure_judgement:{version:'3.0-manual'},scope_confirmed:false,independent:false,reviewer_conclusion:''};
await rejects(()=>rpc('cpp_complete_review_unrestricted',[fid,1,JSON.stringify(body),request,null]),'Browser cannot bypass server route');
await db.exec('set role service_role');
const id=await rpc('cpp_complete_review_unrestricted',[fid,1,JSON.stringify(body),request,null]);
assert(id===await rpc('cpp_complete_review_unrestricted',[fid,1,JSON.stringify(body),request,null]),'Completion is idempotent');
await rejects(()=>rpc('cpp_complete_review_unrestricted',[fid,1,JSON.stringify({...body,recommendation:'Not closure ready'}),request,null]),'Request reuse with changed input rejected');
await db.exec('reset role');
const snapshot=(await db.query('select data from public.cpp_reviews where id=$1',[id])).rows[0].data;
assert(snapshot.completion_validation==='suspended'&&snapshot.checks.length===0&&!snapshot.rules_assessment,'Entered answers preserved without fabricated engine validation');
assert((await db.query('select mode,status from public.cpp_reports where assessment_id=$1',[id])).rows[0].status==='pending','Report requested');
assert((await db.query('select lifecycle from public.cpp_findings where id=$1',[fid])).rows[0].lifecycle==='review_completed','Completion never formally closes finding');
await db.exec('set role service_role');
await rejects(()=>rpc('cpp_complete_review_unrestricted',[fid,1,JSON.stringify(body),crypto.randomUUID(),null]),'Completed history cannot be overwritten');
const revised=await rpc('cpp_complete_review_unrestricted',[fid,1,JSON.stringify({...body,recommendation:'Not closure ready'}),crypto.randomUUID(),id]);
await db.exec('reset role');
assert((await db.query('select supersedes_id from public.cpp_reviews where id=$1',[revised])).rows[0].supersedes_id===id,'Correction appends linked revision');
assert((await db.query('select count(*)::int n from public.cpp_reviews where finding_id=$1',[fid])).rows[0].n===2,'Original assessment retained');
console.log(`Temporary review completion: ${checks} checks passed; isolated database.`);await db.close();
