import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@insforge/sdk';
import { recurringGross } from '../../src/lib/billing.mjs';
const link = JSON.parse(readFileSync('.insforge/project.json', 'utf8'));
const parent = JSON.parse(readFileSync('.insforge/project.parent.json', 'utf8'));
if (link.project_id === parent.project_id || link.oss_host === 'https://556adz76.us-east.insforge.app') {
  throw new Error('Welcome terms SQL assertions require an isolated backend branch.');
}
function cli(args) {
  const current = JSON.parse(readFileSync('.insforge/project.json', 'utf8'));
  assert.equal(current.project_id, link.project_id, 'Backend changed during isolated tests');
  const result = spawnSync(process.execPath, ['node_modules/@insforge/cli/dist/index.js', ...args, '--json'], { encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) throw new Error(result.stderr || 'Backend check failed');
  return JSON.parse(result.stdout);
}
const query = sql => cli(['db', 'query', sql]).rows;
const anonKey = cli(['secrets', 'get', 'ANON_KEY']).value;
assert.ok(anonKey);
query("INSERT INTO public.menupro_plans VALUES('local','Local',9990,99900,1,'CLP'),('grupo','Grupo',24990,249900,3,'CLP') ON CONFLICT(id) DO NOTHING; INSERT INTO public.menupro_commercial_settings(id,grupo_enabled,annual_enabled) VALUES(true,true,true) ON CONFLICT(id) DO UPDATE SET grupo_enabled=true,annual_enabled=true;");
async function rpc(client, name, args) {
  const result = await client.database.rpc(name, args);
  assert.equal(result.error, null, result.error?.message);
  return result.data;
}
async function account(label) {
  const email = `menupro-welcome-${label}-${randomUUID()}@example.invalid`;
  const auth = createClient({ baseUrl: link.oss_host, anonKey, isServerMode: true });
  const { data, error } = await auth.auth.signUp({ email, password: 'IsolatedWelcomeTest123!' });
  assert.equal(error, null, error?.message);
  assert.ok(data?.accessToken, 'Disable email verification on the isolated branch before running');
  const client = createClient({ baseUrl: link.oss_host, anonKey, accessToken: data.accessToken, isServerMode: true });
  query(`UPDATE auth.users SET email_verified=true WHERE id='${data.user.id}'`);
  const business = await rpc(client, 'menupro_ensure_business', { p_name: 'Isolated welcome ' + label });
  return { client, id: data.user.id, business, email };
}
const admin = await account('admin');
const customer = await account('personalized');
const other = await account('default');
const secret = 'isolated-welcome-' + randomUUID() + randomUUID();
query(`INSERT INTO public.menupro_admins(email) VALUES('${admin.email}');
 INSERT INTO public.menupro_system_keys(name,secret_hash) VALUES('worker','${createHash('sha256').update(secret).digest('hex')}') ON CONFLICT(name) DO UPDATE SET secret_hash=excluded.secret_hash;
 UPDATE public.menupro_commercial_settings SET grupo_enabled=true,annual_enabled=true;
 UPDATE public.menupro_subscriptions SET status='trial',trial_started_at=now()-interval '1 day',trial_ends_at=now()+interval '14 days',first_menu_saved_at=now() WHERE business_id IN ('${customer.business}','${other.business}');`);
const quote = (who, cycle = 'monthly') => rpc(who.client, 'menupro_quote', { p_business_id: who.business, p_plan_id: 'local', p_cycle: cycle });
const offer = { p_business_id: customer.business, p_percent: 95, p_payments: 1, p_reason: 'Controlled first production payment' };
assert.ok((await customer.client.database.rpc('menupro_admin_set_welcome', offer)).error, 'Customer granted its own discount');
assert.ok((await other.client.database.rpc('menupro_quote', { p_business_id: customer.business, p_plan_id: 'local', p_cycle: 'monthly' })).error, 'Cross-business quote was readable');
assert.ok((await customer.client.database.from('menupro_subscriptions').update({ monthly_welcome_percent: 95 }).eq('business_id', customer.business)).error, 'Customer changed protected terms');
await rpc(admin.client, 'menupro_admin_set_welcome', offer);
const personalized = await quote(customer);
assert.equal(personalized.honorarium_gross, 500); assert.equal(personalized.gross_amount, 500);
assert.equal(personalized.discount_percent, 95); assert.equal(personalized.discount_payments, 1);
assert.ok(Date.parse(personalized.starts_at) > Date.now() + 13 * 86400000, 'Trial was shortened');
assert.equal((await quote(customer, 'annual')).honorarium_gross, 89910);
const profile = { p_business_id: customer.business, p_rut: '111111111', p_legal_name: 'Isolated recipient',
  p_address: 'Isolated address 123', p_commune: 'Santiago', p_email: customer.email, p_withholding_party: 'recipient' };
await rpc(customer.client, 'menupro_save_billing_profile', profile);
assert.equal((await quote(customer)).gross_amount, 424);
await rpc(customer.client, 'menupro_save_billing_profile', { ...profile, p_withholding_party: 'emitter' });
const reserve = who => rpc(who.client, 'menupro_reserve_checkout', { p_business_id: who.business, p_plan_id: 'local', p_cycle: 'monthly', p_accept_renewal: true });
const checkout = await reserve(customer);
assert.equal(checkout.monthly_welcome_percent, 95); assert.equal(checkout.monthly_welcome_payments, 1);
assert.ok((await admin.client.database.rpc('menupro_admin_set_welcome', { ...offer, p_percent: 20 })).error, 'Existing checkout terms were mutable');
const worker = createClient({ baseUrl: link.oss_host, anonKey, isServerMode: true });
const work = (name, args = {}) => rpc(worker, name, { p_secret: secret, ...args });
const providerId = 'isolated-welcome-' + randomUUID();
await work('menupro_bind_checkout', { p_request_id: checkout.id, p_provider_id: providerId, p_url: 'https://www.mercadopago.cl/subscriptions/checkout?id=isolated' });
await work('menupro_provider_status', { p_request_id: checkout.id, p_provider_id: providerId, p_status: 'authorized' });
let outbox = await work('menupro_worker_outbox');
let subscription = outbox.subscriptions.find(s => s.business_id === customer.business);
assert.ok(subscription); assert.equal(recurringGross(subscription), 500, 'Authorization lost the pending offer');
const now = new Date().toISOString();
const payment = (id, amount, status = 'approved', requestId = checkout.id) => ({ p_request_id: requestId, p_payment_id: id,
  p_invoice_id: id, p_status: status, p_amount: amount, p_currency: 'CLP', p_approved_at: status === 'approved' ? now : null,
  p_modified_at: now, p_due_at: now });
await work('menupro_apply_payment', payment('isolated-rejected', 500, 'rejected'));
assert.equal(query(`SELECT welcome_payments_used FROM public.menupro_subscriptions WHERE business_id='${customer.business}'`)[0].welcome_payments_used, 0);
assert.ok((await worker.database.rpc('menupro_apply_payment', { p_secret: secret, ...payment('isolated-wrong', 7992) })).error, 'Incorrect first amount was accepted');
await work('menupro_apply_payment', payment('isolated-first', 500));
const firstEnd = query(`SELECT current_period_end FROM public.menupro_subscriptions WHERE business_id='${customer.business}'`)[0].current_period_end;
await work('menupro_apply_payment', payment('isolated-first', 500));
assert.equal(query(`SELECT current_period_end FROM public.menupro_subscriptions WHERE business_id='${customer.business}'`)[0].current_period_end, firstEnd);
outbox = await work('menupro_worker_outbox'); subscription = outbox.subscriptions.find(s => s.business_id === customer.business);
assert.equal(subscription.welcome_payments_used, 1); assert.equal(recurringGross(subscription), 9990);
assert.ok((await worker.database.rpc('menupro_apply_payment', { p_secret: secret, ...payment('isolated-second', 500) })).error, 'Personalized discount persisted into renewal');
await work('menupro_apply_payment', payment('isolated-second', 9990));
assert.deepEqual(query(`SELECT honorarium_gross FROM public.menupro_fiscal_documents WHERE business_id='${customer.business}' ORDER BY honorarium_gross`).map(r => r.honorarium_gross), [500, 9990]);
const standard = await quote(other);
assert.equal(standard.honorarium_gross, 7992); assert.equal(standard.discount_percent, 20); assert.equal(standard.discount_payments, 3);
await rpc(other.client, 'menupro_save_billing_profile', { ...profile, p_business_id: other.business, p_email: other.email, p_withholding_party: 'emitter' });
const standardCheckout = await reserve(other);
assert.equal(standardCheckout.monthly_welcome_percent, 20); assert.equal(standardCheckout.monthly_welcome_payments, 3);
for (let i = 1; i <= 4; i++) await work('menupro_apply_payment', payment('isolated-default-' + i, i <= 3 ? 7992 : 9990, 'approved', standardCheckout.id));
assert.equal(query(`SELECT count(*)::int AS total FROM public.menupro_fiscal_documents WHERE business_id='${other.business}' AND honorarium_gross=7992`)[0].total, 3);
console.log('Passed: real user sessions, business isolation, protected terms, trial dates, withholding, rejected and duplicate payments, first payment at 500, renewal at 9990, fiscal amounts and unchanged standard welcome. No provider payments or emails were sent.');
