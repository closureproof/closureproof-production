// Read-only deployment check: no account, finding, evidence or review is created.
import fs from 'node:fs/promises';
const env = { ...process.env };
try {
  const content = await fs.readFile(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch { /* Environment configuration can also be provided by the shell. */ }
const url = (env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL)?.replace(/\/$/, '');
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw Error('Configure the public Supabase URL and publishable/anon key.');
if (key.startsWith('sb_secret_')) throw Error('Use a public browser key.');
if (key.split('.').length === 3 && JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon') throw Error('Use an anon browser key.');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
let failures = 0;
for (const table of ['cpp_protocols', 'cpp_findings', 'cpp_evidence', 'cpp_reviews', 'cpp_events', 'cpp_legacy_records', 'cpp_iso27001_tasks', 'cpp_reports', 'cpp_followups', 'cpp_review_cycles', 'cpp_approval_requests', 'cpp_approval_decisions', 'cpp_scope_catalogues']) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers });
  const body = await res.json();
  if (!res.ok) { failures++; console.log(`${table}: ${res.status} (${body.code || 'error'})`); }
  else console.log(`${table}: public read available`);
}
const boot = await fetch(`${url}/rest/v1/rpc/cpp_bootstrap`, { method: 'POST', headers, body: '{}' });
const result = await boot.json();
if (!boot.ok || !result.organisations?.length) { failures++; console.log(`Pilot workspace: unavailable (${boot.status})`); }
else console.log('Pilot workspace: available without sign-in');
// Nonexistent evidence ensures this signature check cannot write a judgement.
const signature = await fetch(`${url}/rest/v1/rpc/cpp_review_evidence`, { method: 'POST', headers, body: JSON.stringify({ p_id: '00000000-0000-4000-8000-999999999999', p_revision: 1, p_disposition: 'insufficient', p_rationale: 'Deployment signature check only.' }) });
const error = await signature.json();
if (error.code === 'PGRST202' || signature.ok) { failures++; console.log('Public evidence-review RPC: check migration version'); }
else console.log('Public evidence-review RPC: installed');
const versions = await fetch(`${url}/rest/v1/cpp_protocols?select=code,version&version=eq.1.0-iso27001`, { headers });
const protocols = await versions.json();
if (!versions.ok || !Array.isArray(protocols) || protocols.length !== 10) { failures++; console.log('ISO 27001 mapped templates: migration not installed'); }
else console.log('ISO 27001 mapped templates: all 10 installed');
const catalogue = await fetch(`${url}/rest/v1/cpp_iso27001_tasks?select=id`, { headers });
const tasks = await catalogue.json();
if (!catalogue.ok || !Array.isArray(tasks) || tasks.length !== 153) { failures++; console.log('ISO 27001 catalogue: migration not installed'); }
else console.log('ISO 27001 catalogue: 153 tasks installed');
const scopeRpc = await fetch(`${url}/rest/v1/rpc/cpp_apply_iso27001_checklist`, { method: 'POST', headers, body: JSON.stringify({ p_id: '00000000-0000-4000-8000-999999999999', p_revision: 1, p_task_ids: ['ACC-10'] }) });
const scopeError = await scopeRpc.json();
if (scopeError.code !== '42501' || !scopeError.message?.includes('Finding unavailable')) { failures++; console.log('ISO 27001 scope RPC: unavailable or unexpected response'); }
else console.log('ISO 27001 scope RPC: installed');
for (const [name, body] of [
  ['cpp_complete_review', { p_finding: '00000000-0000-4000-8000-999999999999', p_revision: 1, p_review: {}, p_request_id: '00000000-0000-4000-8000-999999999998', p_supersedes: null }],
  ['cpp_workflow_action', { p_finding: '00000000-0000-4000-8000-999999999999', p_revision: 1, p_assessment: null, p_action: 'resubmit', p_data: {}, p_request_id: '00000000-0000-4000-8000-999999999998' }],
  ['cpp_amend_review_scope', { p_id: '00000000-0000-4000-8000-999999999999', p_revision: 1, p_scope: {}, p_actor: 'Schema check', p_reason: 'Nonexistent-record signature check only.' }],
  ['cpp_begin_report', { p_report: '00000000-0000-4000-8000-999999999999' }],
]) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const result = await response.json();
  if (response.ok || !['Finding unavailable','Report unavailable'].some(text => result.message?.includes(text))) { failures++; console.log(`${name}: migration unavailable or unexpected response`); }
  else console.log(`${name}: installed (nonexistent-record check)`);
}
const scopeCatalogue = await fetch(`${url}/rest/v1/cpp_scope_catalogues?select=version&version=eq.1.0-control-scope`, {headers});
const scopeVersions = await scopeCatalogue.json();
if (!scopeCatalogue.ok || !Array.isArray(scopeVersions) || scopeVersions.length !== 1) {failures++; console.log('Control scope mapping catalogue: unavailable');}
else console.log('Control scope mapping catalogue: installed');
const judgementSchema=await fetch(`${url}/rest/v1/rpc/cpp_judgement_schema_version`,{method:'POST',headers,body:'{}'});
const judgementVersion=await judgementSchema.json();
if(!judgementSchema.ok||judgementVersion!=='2.0-manual'){failures++;console.log('Simplified judgement completion: migration unavailable');}
else console.log('Simplified judgement completion: 2.0-manual installed');
const progressiveSchema=await fetch(`${url}/rest/v1/rpc/cpp_progressive_judgement_version`,{method:'POST',headers,body:'{}'});
const progressiveVersion=await progressiveSchema.json();
if(!progressiveSchema.ok||progressiveVersion!=='3.0-manual'){failures++;console.log('Conditional judgement completion: migration unavailable');}
else console.log('Conditional judgement completion: 3.0-manual installed');
console.log('No user records or files created. Authenticated/private historical tables were not changed.');
process.exitCode = failures ? 1 : 0;
