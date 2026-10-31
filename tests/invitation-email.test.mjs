import test from 'node:test';
import assert from 'node:assert/strict';
import { sendInvitationEmail } from '../src/lib/invitation-email.mjs';

const invitation = { id: 'invite-1', to: 'guest@example.invalid', businessName: 'Café <Centro> & Amigos',
  url: 'https://www.menupro.cl/app/dashboard/business?invitation=invite-1', kind: 'team' };
const config = { enabled: true, apiKey: 'test-only', from: 'MenuPro <invitaciones@example.invalid>' };

test('disabled or missing configuration never contacts the email provider', async () => {
  const neverSend = () => assert.fail('Email provider must not be called');
  assert.deepEqual(await sendInvitationEmail(invitation, { ...config, enabled: false }, neverSend), { emailSent: false, emailStatus: 'disabled' });
  for (const missing of [{ apiKey: '' }, { from: '' }, { from: 'sender@example.invalid\r\nBcc: other@example.invalid' }]) {
    assert.deepEqual(await sendInvitationEmail(invitation, { ...config, ...missing }, neverSend), { emailSent: false, emailStatus: 'unconfigured' });
  }
});

test('team invitations use the authenticated Resend API, an idempotency key, and escaped HTML', async () => {
  const result = await sendInvitationEmail(invitation, config, async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    assert.equal(options.headers['Idempotency-Key'], 'menupro-invitation/team/invite-1');
    assert.ok(options.signal instanceof AbortSignal);
    const email = JSON.parse(options.body);
    assert.equal(email.from, config.from);
    assert.deepEqual(email.to, [invitation.to]);
    assert.match(email.html, /Café &lt;Centro&gt; &amp; Amigos/);
    assert.ok(email.html.includes(invitation.url));
    assert.ok(email.text.includes(invitation.url));
    assert.match(email.text, /verifica tu dirección/);
    assert.doesNotMatch(email.html, /test-only/);
    return Response.json({ id: 'resend-message-1' });
  });
  assert.deepEqual(result, { emailSent: true, emailStatus: 'sent' });
});

test('assisted demo invitation explains when the trial begins and has its own idempotency key', async () => {
  await sendInvitationEmail({ ...invitation, kind: 'demo' }, config, async (_url, options) => {
    const email = JSON.parse(options.body);
    assert.equal(options.headers['Idempotency-Key'], 'menupro-invitation/demo/invite-1');
    assert.match(email.text, /15 días, sin tarjeta/);
    assert.match(email.text, /comienza cuando la actives/);
    return Response.json({ id: 'resend-message-2' });
  });
});

test('rejections, timeouts, and malformed provider replies do not claim the email was sent or lose the invitation', async () => {
  for (const send of [
    async () => Response.json({ message: 'Unauthorized' }, { status: 401 }),
    async () => Response.json({ message: 'Too many requests' }, { status: 429 }),
    async () => { throw new DOMException('Timeout', 'TimeoutError'); },
    async () => Response.json({}),
    async () => new Response('not json'),
  ]) {
    assert.deepEqual(await sendInvitationEmail(invitation, config, send), { emailSent: false, emailStatus: 'failed' });
  }
  assert.deepEqual(await sendInvitationEmail({ ...invitation, url: 'javascript:alert(1)' }, config,
    () => assert.fail('Invalid links must not be sent')), { emailSent: false, emailStatus: 'failed' });
});
