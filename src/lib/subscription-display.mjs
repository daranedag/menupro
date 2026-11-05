// Authorization schedules charges; only an approved payment grants a paid period.
// Keep the provider agreement and access state separate in both account views.
export function subscriptionDisplay(subscription, checkout = null, now = Date.now()) {
  const recurring = Boolean(subscription?.provider_subscription_id && !subscription.cancel_at_period_end &&
    ['authorized', 'pending'].includes(subscription.provider_status));
  const authorized = recurring && subscription.provider_status === 'authorized';
  const paid = Boolean(subscription?.current_period_end && Date.parse(subscription.current_period_end) > now);
  const current = checkout?.provider_id === subscription?.provider_subscription_id &&
    checkout?.purpose === 'subscription' && ['authorized', 'paid'].includes(checkout?.status) ? checkout : null;
  const awaitingFirstPayment = authorized && !subscription.current_period_end && current?.status !== 'paid';
  return {
    recurring, authorized, paid, awaitingFirstPayment,
    title: authorized ? (paid ? 'Suscripción activa' : 'Suscripción autorizada') :
      subscription?.cancel_at_period_end ? 'Renovación cancelada' : 'Tu plan',
    planId: current?.plan_id ?? subscription?.plan_id,
    cycle: current?.cycle ?? subscription?.billing_cycle,
    firstChargeAt: awaitingFirstPayment ? current?.starts_at ?? subscription?.trial_ends_at : null,
    firstChargeAmount: awaitingFirstPayment ? current?.gross_amount ?? null : null,
  };
}

export const pendingCheckouts = checkouts => (checkouts ?? []).filter(checkout => ['pending', 'ready'].includes(checkout.status));
