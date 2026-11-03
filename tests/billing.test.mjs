import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { recurringGross, safeCheckoutUrl, verifyMercadoPagoSignature } from '../src/lib/billing.mjs';

test('webhook signatures bind the resource and request and reject expired or forged notices', () => {
  const secret = 'test-secret'; const now = Date.now(); const ts = String(now);
  const v1 = createHmac('sha256', secret).update(`id:123;request-id:req-1;ts:${ts};`).digest('hex');
  const args = { signature: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: '123', secret, now };
  assert.equal(verifyMercadoPagoSignature(args), true);
  assert.equal(verifyMercadoPagoSignature({ ...args, dataId: '456' }), false);
  assert.equal(verifyMercadoPagoSignature({ ...args, requestId: 'req-2' }), false);
  assert.equal(verifyMercadoPagoSignature({ ...args, now: now + 601000 }), false);
  assert.equal(verifyMercadoPagoSignature({ ...args, signature: 'ts=bad,v1=bad' }), false);
});
test('recurring totals end the welcome discount at the right charge, including VAT', () => {
  const local = { billing_cycle: 'monthly', monthly_net: 9990, annual_net: 99900, welcome_redeemed_at: '2026-10-31', welcome_cycle: 'monthly', welcome_payments_used: 2 };
  assert.equal(recurringGross(local), 9510);
  assert.equal(recurringGross({ ...local, welcome_payments_used: 3 }), 11888);
  assert.equal(recurringGross({ ...local, billing_cycle: 'annual', welcome_cycle: 'annual', welcome_payments_used: 0 }), 106993);
  assert.equal(recurringGross({ ...local, billing_cycle: 'annual', welcome_cycle: 'annual', welcome_payments_used: 1 }), 118881);
});
test('checkout redirects only allow HTTPS Mercado Pago domains', () => {
  assert.equal(safeCheckoutUrl('https://www.mercadopago.cl/subscriptions/checkout?id=123'), 'https://www.mercadopago.cl/subscriptions/checkout?id=123');
  assert.throws(() => safeCheckoutUrl('https://mercadopago.cl.evil.example/pay'));
  assert.throws(() => safeCheckoutUrl('javascript:alert(1)'));
  assert.throws(() => safeCheckoutUrl('http://www.mercadopago.cl/pay'));
});

test('a business-specific welcome price survives authorization and ends after its first approved payment', () => {
  const subscription = { billing_cycle: 'monthly', monthly_net: 9990, annual_net: 99900,
    tax_mode: 'honorarios', billing_snapshot: { withholding_party: 'emitter' }, checkout_welcome: true,
    welcome_payments_used: 0, monthly_welcome_percent: 95, monthly_welcome_payments: 1 };
  assert.equal(recurringGross(subscription, '2026-11-18'), 500);
  assert.equal(recurringGross({ ...subscription, monthly_welcome_percent: 90 }, '2026-11-18'), 999);
  assert.equal(recurringGross({ ...subscription, welcome_payments_used: 1 }, '2026-12-18'), 9990);
  assert.equal(recurringGross({ ...subscription, welcome_payments_used: 2 }, '2027-01-18'), 9990);
  assert.equal(recurringGross({ ...subscription, checkout_welcome: false }, '2026-11-18'), 9990);
  assert.equal(recurringGross({ ...subscription, monthly_welcome_percent: undefined, monthly_welcome_payments: undefined }, '2026-11-18'), 7992);
  assert.equal(recurringGross({ ...subscription, billing_cycle: 'annual' }, '2026-11-18'), 89910);
});
