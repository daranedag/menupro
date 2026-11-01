import test from 'node:test';
import assert from 'node:assert/strict';
import { collectorMatchesMode, paymentMatchesEnvironment } from '../src/lib/payment-environment.mjs';
test('subscription test sellers can report live_mode=true without admitting real sellers or foreign payments', () => {
  const testSeller = { id: '123', tags: ['test_user'] }; const realSeller = { id: '123', tags: [] };
  const payment = { collector_id: 123, live_mode: true };
  assert.equal(paymentMatchesEnvironment(payment, testSeller, 'test'), true);
  assert.equal(paymentMatchesEnvironment({ ...payment, live_mode: false }, testSeller, 'test'), true);
  assert.equal(paymentMatchesEnvironment(payment, realSeller, 'test'), false);
  assert.equal(paymentMatchesEnvironment({ ...payment, collector_id: 456 }, testSeller, 'test'), false);
  assert.equal(paymentMatchesEnvironment(payment, testSeller, 'live'), false);
  assert.equal(paymentMatchesEnvironment(payment, realSeller, 'live'), true);
  assert.equal(paymentMatchesEnvironment({ ...payment, live_mode: false }, realSeller, 'live'), false);
  assert.equal(collectorMatchesMode({ id: '123' }, 'test'), false);
  assert.equal(collectorMatchesMode(testSeller, 'disabled'), false);
});
