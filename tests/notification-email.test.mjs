import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverQueuedNotifications } from '../src/lib/notification-email.mjs';
import { sendResendEmail } from '../src/lib/resend-email.mjs';

const config = { enabled: true, apiKey: 'test-only', from: 'MenuPro <notificaciones@example.invalid>', replyTo: 'owner@example.invalid' };
const notice = { id: 'notice-1', token: 'lease-1', email: 'owner@example.invalid', subject: 'Tu demo <termina>', message: 'Conserva tu carta & QR.' };
const appUrl = 'https://menupro.example.invalid';

function queue(notices = [notice]) {
  const completed = []; let claims = 0;
  return { completed, get claims() { return claims; }, async rpc(name, args) {
    if (name === 'menupro_claim_notifications') { claims++; return notices; }
    assert.equal(name, 'menupro_ack_notification'); completed.push(args);
  } };
}

test('disabled or incomplete mail never claims notices or calls the provider', async () => {
  for (const configOverride of [{ enabled: false }, { apiKey: '' }, { from: '' }, { replyTo: 'user@example.invalid\nBcc: other@example.invalid' }]) {
    const never = () => assert.fail('Disabled delivery must not claim or send');
    const result = await deliverQueuedNotifications({ rpc: never, config: { ...config, ...configOverride }, appUrl, fetchEmail: never });
    assert.equal(result.emailed, 0);
  }
});

test('leased reminders use Resend, stable idempotency, escaped content and the configured reply address', async () => {
  const q = queue();
  const result = await deliverQueuedNotifications({ rpc: q.rpc, config, appUrl, fetchEmail: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    assert.equal(options.headers['Idempotency-Key'], 'menupro-notification/notice-1');
    const mail = JSON.parse(options.body);
    assert.deepEqual(mail.to, [notice.email]); assert.equal(mail.reply_to, config.replyTo);
    assert.match(mail.html, /Tu demo &lt;termina&gt;/); assert.match(mail.html, /carta &amp; QR/);
    assert.match(mail.text, /https:\/\/menupro.example.invalid\/app\/dashboard\/billing/);
    assert.doesNotMatch(mail.html, /test-only/);
    return Response.json({ id: 'resend-1' });
  } });
  assert.equal(result.emailed, 1); assert.equal(result.emailFailures, 0);
  assert.deepEqual(q.completed, [{ p_notification_id: notice.id, p_token: notice.token, p_sent: true, p_email_id: 'resend-1' }]);
});

test('rate limiting releases the failed notice, leaves remaining leases for retry and does not mark anything sent', async () => {
  const q = queue([notice, { ...notice, id: 'notice-2' }]);
  const result = await deliverQueuedNotifications({ rpc: q.rpc, config, appUrl,
    fetchEmail: async () => Response.json({}, { status: 429 }) });
  assert.equal(result.emailFailures, 1); assert.equal(result.deferred, 1);
  assert.deepEqual(q.completed.map(v => v.p_sent), [false]);
});

test('provider timeouts and malformed replies remain retryable', async () => {
  for (const fetchEmail of [async () => { throw new Error('timeout'); }, async () => Response.json({}), async () => new Response('bad json')]) {
    const q = queue();
    const result = await deliverQueuedNotifications({ rpc: q.rpc, config, appUrl, fetchEmail });
    assert.equal(result.emailed, 0); assert.equal(result.emailFailures, 1);
    assert.equal(q.completed[0].p_sent, false);
  }
});

test('a failed acknowledgement after provider acceptance keeps the lease and reuses the same key', async () => {
  const keys = [];
  const fetchEmail = async (_url, options) => { keys.push(options.headers['Idempotency-Key']); return Response.json({ id: 'resend-1' }); };
  await assert.rejects(deliverQueuedNotifications({ config, appUrl, fetchEmail, rpc: async name => {
    if (name === 'menupro_claim_notifications') return [notice];
    throw new Error('database temporarily unavailable');
  } }));
  const q = queue(); await deliverQueuedNotifications({ rpc: q.rpc, config, appUrl, fetchEmail });
  assert.deepEqual(keys, ['menupro-notification/notice-1', 'menupro-notification/notice-1']);
});

test('processing respects its time budget and spaces sends', async () => {
  const q = queue([notice, { ...notice, id: 'notice-2' }, { ...notice, id: 'notice-3' }]);
  let elapsed = 0; const pauses = [];
  const result = await deliverQueuedNotifications({ rpc: q.rpc, config, appUrl, now: () => elapsed, budgetMs: 1000,
    pause: async ms => { pauses.push(ms); elapsed += ms; }, fetchEmail: async () => Response.json({ id: 'resend-1' }) });
  assert.equal(result.emailed, 2); assert.equal(result.deferred, 1); assert.deepEqual(pauses, [650, 650]);
});

test('transport does not treat an empty provider message ID as acceptance', async () => {
  assert.equal((await sendResendEmail({ to: notice.email }, config, async () => Response.json({ id: '' }))).emailSent, false);
});
