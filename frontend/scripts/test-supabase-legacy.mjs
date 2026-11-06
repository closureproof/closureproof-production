import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();const owner='11111111-1111-4111-8111-111111111111';const reviewer='22222222-2222-4222-8222-222222222222';const outsider='33333333-3333-4333-8333-333333333333';const finding='55555555-5555-4555-8555-555555555555';const org='44444444-4444-4444-8444-444444444444';
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;
 create function public.cp_bootstrap() returns integer language sql as $$select 42$$;
 insert into auth.users(id,email,email_confirmed_at)values('${owner}','owner@example.test',now()),('${reviewer}','reviewer@example.test',now()),('${outsider}','outsider@example.test',now());`);
await db.exec(await fs.readFile(new URL('../../supabase/tests/legacy_schema_fixture.sql',import.meta.url),'utf8'));
const tables=['cp_organisations','cp_memberships','cp_findings','cp_evidence','cp_reviews'];
async function sourceSnapshot(){const result={};for(const t of tables)result[t]=(await db.query(`select to_jsonb(t) as row from public.${t} t order by to_jsonb(t)::text`)).rows;return result;}
const before=await sourceSnapshot();const sql=await fs.readFile(new URL('../../supabase/migrations/20261106000100_manual_review_workspace.sql',import.meta.url),'utf8');
await db.exec(sql);await db.exec(sql);
assert.deepEqual(await sourceSnapshot(),before,'Existing tables, fields, NULLs and source records must remain unchanged');
assert.equal((await db.query('select public.cp_bootstrap() as n')).rows[0].n,42,'Legacy functions must remain unchanged');
const f=(await db.query('select * from public.cpw_findings where id=$1',[finding])).rows[0];
assert.equal(f.details.title,before.cp_findings[0].row.title);assert.equal(new Date(f.created_at).getTime(),new Date(before.cp_findings[0].row.created_at).getTime());
assert.equal(f.details.owner,'');assert.equal(f.details.account_reference,'');assert.equal(f.protocol.code,'legacy-unassigned');assert.deepEqual(f.protocol.checks,[]);
assert.equal(f.details.legacy_source.status,'closed');assert.equal(f.details.severity,'High');assert.equal(f.details.deadline,'2026-12-01');
assert.equal((await db.query('select count(*)::int as n from public.cpw_reviews')).rows[0].n,0,'An old approval is not a current structured review');
assert.equal((await db.query('select count(*)::int as n from public.cpw_evidence')).rows[0].n,0,'Unknown legacy storage details must not be fabricated');
assert.equal((await db.query('select count(*)::int as n from public.cpw_legacy_records')).rows[0].n,2);
const legacyFile=(await db.query("select source_record from public.cpw_legacy_records where kind='evidence'")).rows[0].source_record;
assert.equal(legacyFile.sha256,null);assert.equal(legacyFile.storage_path,'old-bucket/original-file.pdf');
async function as(user){await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${user}';`);}
async function rpc(name,args=[]){return(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;}
await as(owner);const boot=await rpc('cpw_bootstrap');assert.equal(boot.organisations[0].id,org);assert.equal(boot.organisations[0].role,'admin','The explicit workspace owner maps to admin in the new namespace');
await as(outsider);assert.equal((await db.query('select * from public.cpw_findings')).rows.length,0);assert.equal((await db.query('select * from public.cpw_legacy_records')).rows.length,0,'Inactive legacy membership is not reactivated');
await as(reviewer);await assert.rejects(()=>rpc('cpw_save_review',[finding,1,JSON.stringify({checks:[]})]),/Select a manual protocol/);
await as(owner);const completed={...f.details,title:'Completed legacy finding',owner:'Remediation owner',account_reference:'Redacted account',affected_systems:'Production',resources:'Actual scope supplied by owner',protocol_code:'access'};delete completed.legacy_source;
await rpc('cpw_update_finding',[finding,1,JSON.stringify(completed)]);
const updated=(await db.query('select * from public.cpw_findings where id=$1',[finding])).rows[0];assert.equal(updated.protocol.code,'access');assert.equal(updated.revision,2);assert.equal(updated.details.legacy_source.title,'Legacy access review record');
await db.exec('reset role');await db.exec(sql);
assert.equal((await db.query('select details from public.cpw_findings where id=$1',[finding])).rows[0].details.title,'Completed legacy finding','Reruns must not overwrite completed records');
assert.deepEqual(await sourceSnapshot(),before);
// Prove unrelated broad storage policies cannot bypass this new bucket's protection.
await db.exec("create policy test_legacy_broad_read on storage.objects for select to public using(true);insert into storage.objects(bucket_id,name,metadata) values('closureproof-workspace-evidence','unreserved-object','{}');");
await as(outsider);assert.equal((await db.query("select * from storage.objects where bucket_id='closureproof-workspace-evidence'")).rows.length,0,'Restrictive guard protects the new bucket even with an unrelated broad legacy policy');
await db.exec("reset role; grant usage on schema storage to anon; grant select on storage.objects to anon; insert into storage.objects(bucket_id,name,metadata) values('unrelated-public-bucket','unrelated-file','{}'); set role anon;");
assert.equal((await db.query("select * from storage.objects where bucket_id='closureproof-workspace-evidence'")).rows.length,0,'Anonymous legacy policies cannot expose the new bucket');
assert.equal((await db.query("select * from storage.objects where bucket_id='unrelated-public-bucket'")).rows.length,1,'Unrelated existing public access is unchanged');
await db.close();console.log('PASS: exact legacy column schema, source records/functions untouched, conservative imports, inactive membership, explicit protocol assignment, reruns and storage guard.');
