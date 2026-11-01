export function collectorMatchesMode(collector, mode) {
  if (!collector?.id || !Array.isArray(collector.tags)) return false;
  const test = collector.tags.includes('test_user');
  return mode === 'test' ? test : mode === 'live' && !test;
}
export function paymentMatchesEnvironment(payment, collector, mode) {
  if (!collectorMatchesMode(collector, mode) || String(payment.collector_id) !== String(collector.id)) return false;
  // Subscriptions from a test seller use that seller's production credentials;
  // Mercado Pago reports live_mode=true even though both accounts are fictitious.
  return mode === 'test' ? typeof payment.live_mode === 'boolean' : payment.live_mode === true;
}
