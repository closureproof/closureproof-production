// Test-only Supabase contract emulator backed by real PostgreSQL/WASM.
// It is not shipped or used by the application and never contacts the live project.
import { PGlite } from '@electric-sql/pglite';
import http from 'node:http';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const db = new PGlite();
const identities = [
 { id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test',name:'Remediation Owner' },
 { id:'22222222-2222-4222-8222-222222222222',email:'reviewer@example.test',name:'Reviewer Jane' },
 { id:'33333333-3333-4333-8333-333333333333',email:'outsider@example.test',name:'Other Workspace' },
];
await db.exec(`create role anon; create role authenticated;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated; grant select,insert,delete on storage.objects to anon,authenticated;
`);
for(const u of identities) await db.query('insert into auth.users values($1,$2,now(),$3)',[u.id,u.email,JSON.stringify({full_name:u.name})]);
await db.exec(await fs.readFile(new URL('../../supabase/tests/legacy_schema_fixture.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../../supabase/migrations/20261106000100_manual_review_workspace.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../../supabase/migrations/20261106000200_public_pilot.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../../supabase/tests/pre_iso_finding_fixture.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../../supabase/migrations/20261106000300_iso27001_checklists.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../../supabase/migrations/20261109000100_review_completion_workflow.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../../supabase/migrations/20261109000200_control_review_scopes.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../../supabase/migrations/20261109000300_simplified_reviewer_judgement.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../../supabase/migrations/20261109000400_conditional_judgement.sql',import.meta.url),'utf8'));
const objects = new Map(); const tokens = new Map();
const user = u => ({id:u.id,aud:'authenticated',role:'authenticated',email:u.email,email_confirmed_at:new Date().toISOString(),confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:u.name},identities:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
function session(u) { const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url'); const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:u.id,email:u.email,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),session_id:crypto.randomUUID()})+'.test-signature'; tokens.set(token,u); return {access_token:token,refresh_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:user(u)}; }
let queue=Promise.resolve();
function serial(u,fn) { const promise=queue.then(async()=>{await db.exec(`reset role; set role ${u?'authenticated':'anon'}; set request.jwt.claim.sub='${u?.id||''}';`);try{return await fn();}finally{await db.exec('reset role');}});queue=promise.catch(()=>{});return promise; }
function send(res,status,body,headers={}) {res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'http://127.0.0.1:3006','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,prefer,range,x-upsert,cache-control','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Expose-Headers':'Content-Range',...headers});res.end(body instanceof Buffer?body:JSON.stringify(body));}
async function read(req) {const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks);}
const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS')return send(res,200,{}, {'Access-Control-Allow-Headers':req.headers['access-control-request-headers']||'authorization,apikey,content-type'});
 const url=new URL(req.url,'http://127.0.0.1:54330'); const path=decodeURIComponent(url.pathname); const who=tokens.get((req.headers.authorization||'').replace(/^Bearer /,''));
 try {
  if(path==='/health')return send(res,200,{ready:true,testOnly:true});
  if(path.startsWith('/auth/v1/')) {
   if(path.endsWith('/token')) {const body=JSON.parse((await read(req)).toString());const u=url.searchParams.get('grant_type')==='refresh_token'?tokens.get(body.refresh_token):identities.find(u=>u.email===body.email&&body.password==='Test-only-password-42');return u?send(res,200,session(u)):send(res,400,{error:'invalid_grant',error_description:'Invalid login credentials'});}
   if(path.endsWith('/user'))return who?send(res,200,user(who)):send(res,401,{message:'Invalid session'});
   if(path.endsWith('/logout')){tokens.delete((req.headers.authorization||'').replace('Bearer ',''));res.writeHead(204,{'Access-Control-Allow-Origin':'http://127.0.0.1:3006'});return res.end();}
   return send(res,404,{message:'Auth operation unsupported by test fixture'});
  }
  if(path.startsWith('/rest/v1/rpc/')) {
   const name=path.split('/').pop();if(!/^(cpw|cpp)_[a-z0-9_]+$/.test(name))return send(res,404,{});
   const body=JSON.parse((await read(req)).toString()||'{}');const keys=Object.keys(body);if(keys.some(k=>!/^p_[a-z0-9_]+$/.test(k)))return send(res,400,{});
   const sql=`select public.${name}(${keys.map((key,i)=>`${key} => $${i+1}`).join(',')}) as value`;
   const result=await serial(who,()=>db.query(sql,keys.map(k=>typeof body[k]==='object'&&body[k]!==null&&!Array.isArray(body[k])?JSON.stringify(body[k]):body[k])));
   return send(res,200,result.rows[0].value);
  }
  if(path.startsWith('/rest/v1/')) {
   const table=path.split('/').pop();if(!/^(cpw|cpp)_[a-z0-9_]+$/.test(table)||req.method!=='GET')return send(res,404,{});
   let sql=`select * from public.${table}`;const clauses=[];const args=[];
   for(const [key,value]of url.searchParams){if(['select','order','limit','offset'].includes(key))continue;if(!/^[a-z_]+$/.test(key))throw Error('Invalid test query');if(value.startsWith('eq.')){args.push(value.slice(3));clauses.push(`${key}=$${args.length}`);}else throw Error('Unsupported test filter');}
   if(clauses.length)sql+=' where '+clauses.join(' and ');
   if(url.searchParams.has('order')){const[column,direction]=url.searchParams.get('order').split('.');if(!/^[a-z_]+$/.test(column))throw Error('Invalid order');sql+=` order by ${column} ${direction==='desc'?'desc':'asc'}`;}
   const result=await serial(who,()=>db.query(sql,args));
   if((req.headers.accept||'').includes('vnd.pgrst.object')){if(result.rows.length!==1)return send(res,406,{code:'PGRST116',message:'Record unavailable'});return send(res,200,result.rows[0]);}
   return send(res,200,result.rows);
  }
  if(path.startsWith('/storage/v1/object/')) {
   const prefix='/storage/v1/object/';let rest=path.slice(prefix.length);if(rest.startsWith('authenticated/'))rest=rest.slice('authenticated/'.length);
   if(req.method==='DELETE') {const body=JSON.parse((await read(req)).toString());for(const p of body.prefixes){const deleted=await serial(who,()=>db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning name',[rest,p]));if(deleted.rows.length)objects.delete(rest+'/'+p);}return send(res,200,[]);}
   const slash=rest.indexOf('/');const bucket=rest.slice(0,slash);const name=rest.slice(slash+1);const key=bucket+'/'+name;
   if(req.method==='POST'){const bytes=await read(req);const mime=req.headers['content-type']?.split(';')[0];if(bytes.length>26214400)return send(res,413,{message:'Upload too large'});await serial(who,()=>db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',[bucket,name,JSON.stringify({size:bytes.length,mimetype:mime})]));objects.set(key,{bytes,mime});return send(res,200,{Key:key,Id:crypto.randomUUID()});}
   if(req.method==='GET'){const allowed=await serial(who,()=>db.query('select * from storage.objects where bucket_id=$1 and name=$2',[bucket,name]));if(!allowed.rows.length||!objects.has(key))return send(res,404,{message:'Object unavailable'});const object=objects.get(key);return send(res,200,object.bytes,{'Content-Type':object.mime});}
  }
  send(res,404,{message:'Unsupported test route'});
 }catch(error){send(res,error.code==='42501'?403:400,{code:error.code||'TEST_ERROR',message:error.message,details:null,hint:null});}
});
server.listen(54330,'127.0.0.1',()=>console.log('Test-only Supabase/PostgreSQL contract server ready on 54330'));
async function stop(){server.close();await db.close();process.exit(0);}process.on('SIGTERM',stop);process.on('SIGINT',stop);
