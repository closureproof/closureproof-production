import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const db = new PGlite();
await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
const read = (name) =>
  fs.readFile(new URL('../../../supabase/migrations/' + name, import.meta.url), 'utf8');
await db.exec(await read('20261105000100_create_demo_requests.sql'));
await db.exec(
  "insert into public.demo_requests(name,email,company_name,contact_person)values('Earlier Lead','earlier@example.test','Earlier Company','Earlier Contact')",
);
const migration = await read('20261113000100_demo_request_notifications.sql');
await db.exec(migration);
await db.exec(migration);
let checks = 0;
function assert(ok, message) {
  if (!ok) throw Error(message);
  checks++;
}
async function rejects(fn, message) {
  try {
    await fn();
  } catch {
    checks++;
    return;
  }
  throw Error(message);
}
async function rpc(name, args) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) value`,
      args,
    )
  ).rows[0].value;
}
const id = crypto.randomUUID(),
  fingerprint = 'a'.repeat(64),
  data = JSON.stringify({
    name: 'Test Submitter',
    email: 'person@example.test',
    companyName: 'Example Company',
    contactPerson: 'Contact Person',
    contactEmail: '',
    contactPhone: '',
  });
await db.exec('set role anon');
await rejects(() => db.query('select * from public.demo_requests'), 'Public cannot read leads');
await rejects(
  () => rpc('demo_save_request', [id, fingerprint, data]),
  'Public cannot write through service RPC',
);
await db.exec('reset role');
await db.exec('set role authenticated');
await rejects(
  () => db.query('select * from public.demo_requests'),
  'Ordinary authenticated users cannot read leads',
);
await db.exec('reset role');
await db.exec('set role service_role');
assert((await rpc('demo_save_request', [id, fingerprint, data])) === id, 'Saves enquiry');
assert((await rpc('demo_save_request', [id, fingerprint, data])) === id, 'Retry is idempotent');
await rejects(
  () => rpc('demo_save_request', [id, 'b'.repeat(64), data]),
  'Different details cannot reuse request ID',
);
let row = (await db.query('select * from public.demo_requests where id=$1', [id])).rows[0];
assert(
  row.company_name === 'Example Company' &&
    row.contact_email === null &&
    row.notification_status === 'pending',
  'Maps form fields and initial status',
);
const lease = crypto.randomUUID();
const claimed = await rpc('demo_claim_notification', [id, lease]);
assert(claimed.notification_attempts === 1, 'Claim increments attempt');
assert(
  (await rpc('demo_claim_notification', [id, crypto.randomUUID()])) === null,
  'Active lease prevents concurrent send',
);
assert(
  (await rpc('demo_finish_notification', [id, crypto.randomUUID(), 'wrong', null])) === false,
  'Wrong lease cannot finish',
);
assert(
  (await rpc('demo_finish_notification', [id, lease, null, 'Provider unavailable'])) === true,
  'Failed mail recorded',
);
row = (await db.query('select * from public.demo_requests where id=$1', [id])).rows[0];
assert(
  row.name === 'Test Submitter' && row.notification_status === 'failed',
  'Mail failure retains enquiry',
);
const retryLease = crypto.randomUUID();
assert(
  (await rpc('demo_claim_notification', [id, retryLease])).notification_attempts === 2,
  'Retry claim',
);
assert(
  (await rpc('demo_finish_notification', [id, retryLease, 'email-id', null])) === true,
  'Successful mail recorded',
);
assert(
  (await rpc('demo_claim_notification', [id, crypto.randomUUID()])) === null,
  'Sent mail cannot be resent',
);
assert(
  Number((await db.query('select count(*) n from public.demo_requests')).rows[0].n) === 2,
  'Existing lead preserved and no duplicate enquiry',
);
// An abandoned send can be recovered after expiry, with a bounded attempt count.
const second = crypto.randomUUID();
await rpc('demo_save_request', [second, fingerprint, data]);
await rpc('demo_claim_notification', [second, crypto.randomUUID()]);
await db.query(
  "update public.demo_requests set notification_lease_until=now()-interval '1 second'where id=$1",
  [second],
);
assert(
  (await rpc('demo_claim_notification', [second, crypto.randomUUID()])).notification_attempts === 2,
  'Expired lease recoverable',
);
await db.query(
  'update public.demo_requests set notification_attempts=5,notification_lease_until=null where id=$1',
  [second],
);
assert(
  (await rpc('demo_claim_notification', [second, crypto.randomUUID()])) === null,
  'Five-attempt limit',
);
await db.exec('reset role');
await db.close();
// Also install on a project without the old migration.
const fresh = new PGlite();
await fresh.exec('create role anon;create role authenticated;create role service_role bypassrls;');
await fresh.exec(migration);
assert(
  (await fresh.query("select to_regclass('public.demo_requests') t")).rows[0].t === 'demo_requests',
  'Fresh install',
);
await fresh.close();
console.log(`${checks} demo-request/notification SQL checks passed; isolated databases only.`);
