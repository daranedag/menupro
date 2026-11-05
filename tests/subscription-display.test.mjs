import test from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionDisplay, pendingCheckouts } from '../src/lib/subscription-display.mjs';

const now = Date.parse('2026-11-05T20:00:00Z');
const subscription = { provider_subscription_id: 'current', provider_status: 'authorized', plan_id: 'local',
  effective_status: 'trial', trial_ends_at: '2026-11-17T19:15:05Z', current_period_end: null };
const checkout = { purpose: 'subscription', provider_id: 'current', status: 'authorized', cycle: 'monthly', plan_id: 'local',
  starts_at: subscription.trial_ends_at, gross_amount: 999 };

test('authorization during demo schedules a first charge without claiming paid access', () => {
  const view = subscriptionDisplay(subscription, checkout, now);
  assert.equal(view.title, 'Suscripción autorizada');
  assert.equal(view.paid, false);
  assert.equal(view.awaitingFirstPayment, true);
  assert.equal(view.firstChargeAmount, 999);
  assert.equal(view.firstChargeAt, subscription.trial_ends_at);
  assert.equal(view.cycle, 'monthly'); // billing_cycle is null until the first charge.
});

test('approved payment changes summary to active and removes first-charge notice', () => {
  const view = subscriptionDisplay({ ...subscription, current_period_end: '2026-12-17T19:15:05Z' }, { ...checkout, status: 'paid' }, now);
  assert.equal(view.title, 'Suscripción activa');
  assert.equal(view.paid, true);
  assert.equal(view.awaitingFirstPayment, false);
  assert.equal(view.firstChargeAmount, null);
});

test('authorized, paid and cancelled checkouts never offer continuation as pending', () => {
  assert.deepEqual(pendingCheckouts(['pending', 'ready', 'authorized', 'paid', 'cancelled', 'failed'].map(status => ({ status }))),
    [{ status: 'pending' }, { status: 'ready' }]);
});

test('an old or cancelled agreement cannot supply the current first-charge amount', () => {
  for (const invalid of [{ ...checkout, provider_id: 'old' }, { ...checkout, status: 'cancelled' }]) {
    assert.equal(subscriptionDisplay(subscription, invalid, now).firstChargeAmount, null);
  }
  assert.equal(subscriptionDisplay({ ...subscription, cancel_at_period_end: true }, checkout, now).recurring, false);
  assert.equal(subscriptionDisplay({ ...subscription, provider_status: 'cancelled' }, checkout, now).authorized, false);
  assert.equal(subscriptionDisplay(null, null, now).title, 'Tu plan');
});

test('a previously paid expired subscription is not shown as awaiting its first charge', () => {
  const view = subscriptionDisplay({ ...subscription, current_period_end: '2026-10-01T19:15:05Z' }, { ...checkout, status: 'paid' }, now);
  assert.equal(view.paid, false);
  assert.equal(view.awaitingFirstPayment, false);
});
