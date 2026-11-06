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
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw Error('Configure the public Supabase URL and publishable/anon key.');
if (key.startsWith('sb_secret_')) throw Error('Use a public browser key.');
if (key.split('.').length === 3 && JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon') throw Error('Use an anon browser key.');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
let failures = 0;
for (const table of ['cpp_protocols', 'cpp_findings', 'cpp_evidence', 'cpp_reviews', 'cpp_events', 'cpp_legacy_records', 'cpp_iso27001_tasks']) {
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
console.log('No user records or files created. Authenticated/private historical tables were not changed.');
process.exitCode = failures ? 1 : 0;
