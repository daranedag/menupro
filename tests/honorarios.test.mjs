import test from 'node:test';
import assert from 'node:assert/strict';
import { honorariumAmounts, honorariumRate, validRut } from '../src/lib/honorarios.mjs';
import { recurringGross } from '../src/lib/billing.mjs';
test('gross prices stay fixed; withholding changes the transfer, including the Chilean year boundary', () => {
  assert.deepEqual(honorariumAmounts(9990, 'recipient', '2026-11-01'), { honorarium_gross: 9990, retention_rate: .1525, withholding_amount: 1523, gross_amount: 8467 });
  assert.equal(honorariumAmounts(9990, 'emitter', '2026-11-01').gross_amount, 9990);
  assert.equal(honorariumRate('2027-01-01T02:00:00Z'), .1525);
  assert.equal(honorariumRate('2027-01-01T04:00:00Z'), .16);
  assert.equal(honorariumRate('2028-04-01'), .17);
  const s = { tax_mode: 'honorarios', billing_snapshot: { withholding_party: 'recipient' }, billing_cycle: 'monthly', monthly_net: 9990,
    welcome_redeemed_at: '2026-10-01', welcome_cycle: 'monthly', welcome_payments_used: 2 };
  assert.equal(recurringGross(s, '2026-11-01'), 6773);
  assert.equal(recurringGross({ ...s, welcome_payments_used: 3 }, '2027-02-01'), 8392);
  assert.equal(recurringGross({ ...s, checkout_welcome: true, welcome_redeemed_at: null, welcome_cycle: null, welcome_payments_used: 0 }, '2026-11-01'), 6773);
  assert.equal(recurringGross({ ...s, checkout_welcome: false }, '2026-11-01'), 8467);
});
test('RUT check digit rejects malformed recipients', () => {
  assert.equal(validRut('11.111.111-1'), true); assert.equal(validRut('11111111-2'), false);
  assert.equal(validRut('00000000-0'), false); assert.equal(validRut('123'), false);
});
