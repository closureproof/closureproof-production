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

await db.exec(await read('20261111000500_ai_review_preparation.sql'));await db.exec(await read('20261111000500_ai_review_preparation.sql'));
await db.exec(await read('20261114000200_multi_document_review.sql'));await db.exec(await read('20261114000200_multi_document_review.sql'));
await db.exec(await fs.readFile(new URL('../../../supabase/tests/ai_extraction_fixture.sql',import.meta.url),'utf8'));
let checks=0;function assert(ok,message){if(!ok)throw Error(message);checks++;}
async function rejects(fn,message){try{await fn();}catch{checks++;return;}throw Error(message);}
async function rpc(name,args=[]){return(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}
const run=await rpc('cpp_test_ai_evidence');const id=crypto.randomUUID(),lease=crypto.randomUUID(),fingerprint='a'.repeat(64);const args=[id,run.finding_id,2,fingerprint,JSON.stringify({facts:[],scope:'pinned'}),'test-model',lease,100];
await db.exec('set role anon');
assert(await rpc('cpp_ai_review_preparation_version')==='1.0-ai-review-preparation','Public schema preflight');
await rejects(()=>rpc('cpp_claim_ai_review_proposal',args),'Public cannot create AI proposals');
await rejects(()=>db.query('select * from public.cpp_ai_review_proposals'),'Public cannot read private proposals');
await db.exec('reset role');await db.exec('set role service_role');
const claimed=await rpc('cpp_claim_ai_review_proposal',args);assert(claimed.status==='processing'&&claimed.attempt===1,'Claim acquires durable lease');
await rejects(()=>rpc('cpp_claim_ai_review_proposal',args),'Active lease prevents duplicate provider call');
await rejects(()=>rpc('cpp_claim_ai_review_proposal',[id,run.finding_id,2,'b'.repeat(64),'{}','test-model',crypto.randomUUID(),100]),'Request cannot change source');
await rejects(()=>rpc('cpp_claim_ai_review_proposal',[crypto.randomUUID(),run.finding_id,1,fingerprint,'{}','test-model',crypto.randomUUID(),100]),'Stale revision rejected');
const budget=(await db.query('select * from public.cpp_ai_daily_usage where day=current_date')).rows[0];assert(budget.calls===1&&budget.starts===1,'Shares durable quota counters');
await db.query("update public.cpp_ai_review_proposals set status='ready',output=$2::jsonb,prepared=$3::jsonb,finished_at=now() where id=$1",[id,'{"summary":"Draft only"}','{"sourceKeys":[]}']);
const ready=await rpc('cpp_claim_ai_review_proposal',args);assert(ready.status==='ready'&&ready.attempt===1,'Ready result is idempotently reused');
await rejects(()=>db.query("update public.cpp_ai_review_proposals set output='{}' where id=$1",[id]),'Ready proposal immutable');
await rejects(()=>db.query('update public.cpp_ai_review_proposals set source_fingerprint=$2 where id=$1',[id,'b'.repeat(64)]),'Source context immutable');
const second=crypto.randomUUID();await rpc('cpp_claim_ai_review_proposal',[second,...args.slice(1)]);
await db.query("update public.cpp_ai_review_proposals set status='failed',lease_until=null where id=$1",[second]);
const retried=await rpc('cpp_claim_ai_review_proposal',[second,...args.slice(1)]);assert(retried.attempt===2,'Explicit retry acquires next attempt');
await db.query("update public.cpp_ai_review_proposals set status='failed',attempt=3,batch_attempt=3,lease_until=null where id=$1",[second]);
await rejects(()=>rpc('cpp_claim_ai_review_proposal',[second,...args.slice(1)]),'Attempt bound enforced');
const resumable=crypto.randomUUID();
for(let batch=0;batch<5;batch++){
 const step=await rpc('cpp_claim_ai_review_proposal',[resumable,...args.slice(1)]);assert(step.status==='processing','Each pending batch claims one bounded call');
 await db.query("update public.cpp_ai_review_proposals set status='pending',batch_attempt=0,batch_outputs=batch_outputs||$2::jsonb,lease_until=null where id=$1",[resumable,JSON.stringify([{batch}])]);
}
assert((await db.query('select jsonb_array_length(batch_outputs) n from public.cpp_ai_review_proposals where id=$1',[resumable])).rows[0].n===5,'Preparation can resume across more than three successful batches');
console.log(`${checks} isolated AI review-preparation SQL checks passed`);await db.close();
