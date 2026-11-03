import test from 'node:test';
import assert from 'node:assert/strict';
import { mercadoPagoFailure } from '../src/lib/mercadopago-errors.mjs';

test('the provider minimum is explained as an actionable validation error', () => {
  const result = mercadoPagoFailure(400, { message: 'Cannot pay an amount lower than $ 950.00' });
  assert.equal(result.status, 422);
  assert.match(result.message, /mínimo de \$950/);
  assert.deepEqual(result.diagnostic, { providerStatus: 400, code: 'amount_below_minimum', minimumAmount: 950 });
});

test('unrecognized responses keep credentials, payer data and provider bodies out of messages and diagnostics', () => {
  const result = mercadoPagoFailure(401, { message: 'Rejected payer private@example.invalid', access_token: 'private-access-token', error: 'private-error' });
  assert.equal(result.status, 502);
  for (const secret of ['private@example.invalid', 'private-access-token', 'private-error']) assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(result.diagnostic, { providerStatus: 401, code: 'provider_rejected' });
});

test('malformed amounts and server outages are not mistaken for minimum-price errors', () => {
  for (const [status, body] of [[400, null], [400, 'not-json'], [400, { message: 'Cannot pay an amount lower than $ NaN' }],
    [400, { message: 'Cannot pay an amount lower than $ 0.00' }], [503, { message: 'Cannot pay an amount lower than $ 950.00' }]]) {
    assert.equal(mercadoPagoFailure(status, body).status, 502);
  }
});
