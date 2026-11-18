import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;
 grant select,insert,delete on storage.objects to anon,authenticated;`);
await db.exec(
  await fs.readFile(
    new URL('../../../supabase/migrations/20261106000200_public_pilot.sql', import.meta.url),
    'utf8',
  ),
);
const security = await fs.readFile(
  new URL('../../../supabase/migrations/20261113000200_request_security.sql', import.meta.url),
  'utf8',
);
await db.exec(security);
await db.exec(security);
let checks = 0;
const assert = (ok, label) => {
  if (!ok) throw Error(label);
  checks++;
};
const subject = 'a'.repeat(64);
const limit = async (action, id) =>
  (await db.query('select public.cpp_request_limit($1,$2) allowed', [action, id])).rows[0].allowed;
await db.exec('set role anon');
try {
  await limit('demo', subject);
  throw Error('Anonymous budget write allowed');
} catch (e) {
  assert(e.message !== 'Anonymous budget write allowed', 'Budget RPC is server-only');
}
assert(
  (
    await db.query(
      "select has_function_privilege('anon','public.cpp_finalize_upload(uuid,integer)','EXECUTE') allowed",
    )
  ).rows[0].allowed === false,
  'Anonymous cannot bypass content validation',
);
assert(
  (await db.query('select public.cpp_bootstrap() data')).rows.length === 1,
  'Public workspace remains accessible',
);
await db.exec('reset role; set role service_role');
for (let i = 0; i < 10; i++) assert(await limit('demo', subject), 'Request within budget');
assert((await limit('demo', subject)) === false, 'Per-client rate limit');
assert((await limit('demo', 'b'.repeat(64))) === true, 'Different client has separate allowance');
assert((await limit('analysis-read', subject)) === true, 'Read and write budgets separate');
await db.exec('reset role');
await db.exec(
  "update cpp_private.request_budgets set requests=100 where action='demo' and subject='global'",
);
await db.exec('set role service_role');
assert((await limit('demo', 'c'.repeat(64))) === false, 'Global rate cap');
await db.exec('reset role');
await db.close();
console.log(`${checks} request security SQL checks passed; isolated database only.`);
