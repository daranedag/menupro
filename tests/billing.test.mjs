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
