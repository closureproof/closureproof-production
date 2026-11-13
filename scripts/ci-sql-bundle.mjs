import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migrations=path.join(root,'supabase/migrations');
const mode=process.argv[2];
const names=['CI_SQL_BUNDLE_1','CI_SQL_BUNDLE_2','CI_SQL_BUNDLE_3','CI_SQL_BUNDLE_4'];
if(mode==='prepare') {
  const files=(await fs.readdir(migrations)).filter(name=>/^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if(!files.length)throw Error('No local migrations found.');
  const payload=JSON.stringify(Object.fromEntries(await Promise.all(files.map(async name=>[name,await fs.readFile(path.join(migrations,name),'utf8')]))));
  const bundle=gzipSync(payload).toString('base64');
  if(bundle.length>180000)throw Error('SQL bundle exceeds four secret chunks; increase the workflow and script capacity together.');
  const output=path.join(root,'docs/private/github-ci');await fs.mkdir(output,{recursive:true,mode:0o700});
  for(const [index,name] of names.entries())await fs.writeFile(path.join(output,name+'.txt'),bundle.slice(index*45000,(index+1)*45000),{mode:0o600});
  console.log(`Prepared ${files.length} migrations in ${names.length} private secret files under docs/private/github-ci/.`);
  console.log('Paste each non-empty file into the same-named secret in GitHub environment stagging. These files contain SQL, not database credentials or data.');
  console.log('Bundle SHA-256: '+createHash('sha256').update(bundle).digest('hex'));
} else if(mode==='restore') {
  const bundle=names.map(name=>process.env[name]||'').join('');
  if(!bundle)throw Error('Missing CI SQL bundle. Run npm run ci:prepare-sql locally and configure CI_SQL_BUNDLE_1..4 in GitHub environment stagging.');
  const parsed=JSON.parse(gunzipSync(Buffer.from(bundle,'base64'),{maxOutputLength:8*1024*1024}).toString('utf8'));
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Object.keys(parsed).length)throw Error('Invalid SQL bundle.');
  for(const [name,sql]of Object.entries(parsed))if(!/^\d{14}_[a-z0-9_]+\.sql$/.test(name)||typeof sql!=='string')throw Error('Invalid SQL bundle file.');
  // Refuse stale bundles rather than silently running only part of the SQL checks.
  const scriptDir=path.join(root,'apps/web/scripts');
  const required=new Set();
  for(const name of await fs.readdir(scriptDir))if(name.endsWith('.mjs')){
    const source=await fs.readFile(path.join(scriptDir,name),'utf8');
    for(const match of source.matchAll(/\b\d{14}_[a-z0-9_]+\.sql\b/g))required.add(match[0]);
  }
  for(const name of required)if(!(name in parsed))throw Error('CI SQL bundle is stale; missing '+name+'. Regenerate and update the environment secrets.');
  await fs.mkdir(migrations,{recursive:true});
  for(const [name,sql]of Object.entries(parsed))await fs.writeFile(path.join(migrations,name),sql,{mode:0o600});
  console.log(`Restored ${Object.keys(parsed).length} SQL migration files for isolated tests.`);
} else throw Error('Use prepare or restore.');
