// Imported only by the isolated integration-test server. Never changes app code
// or its production provider origin, and cannot pass through to real payments.
import { readFileSync, writeFileSync } from 'node:fs';
const originalFetch = globalThis.fetch;
const file = '.insforge/payment-fixture.json';
globalThis.fetch = async function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname !== 'api.mercadopago.com') return originalFetch(input, init);
  const project = JSON.parse(readFileSync('.insforge/project.json', 'utf8'));
  const parent = JSON.parse(readFileSync('.insforge/project.parent.json', 'utf8'));
  if (project.project_id === parent.project_id || process.env.NODE_ENV === 'production') throw Error('Provider fixtures require an isolated development backend.');
  const state = JSON.parse(readFileSync(file, 'utf8'));
  const method = init?.method ?? 'GET'; let value;
  if (url.pathname === '/users/me') value = { id: 3426677054, tags: ['test_user'] };
  else if (url.pathname === '/preapproval/search') value = { results: Object.values(state.subscriptions).filter(s => s.external_reference === url.searchParams.get('external_reference')) };
  else if (url.pathname === '/preapproval' && method === 'POST') {
    const data = JSON.parse(init.body);
    const key = 'fixture-' + data.external_reference;
    value = { ...data, id: key, live_mode: false, next_payment_date: data.auto_recurring.start_date,
      init_point: 'https://www.mercadopago.cl/subscriptions/checkout?preapproval_id=' + key };
    state.subscriptions[key] = value; writeFileSync(file, JSON.stringify(state));
  } else if (url.pathname.startsWith('/preapproval/')) {
    const key = url.pathname.split('/').at(-1); value = state.subscriptions[key];
    if (method === 'PUT' && value) { Object.assign(value, JSON.parse(init.body)); writeFileSync(file, JSON.stringify(state)); }
  } else if (url.pathname === '/authorized_payments/search') {
    const invoices = Object.values(state.invoices).filter(s => s.preapproval_id === url.searchParams.get('preapproval_id'));
    const offset = Number(url.searchParams.get('offset') ?? 0);
    value = { paging: { offset, limit: 50, total: invoices.length }, results: invoices.slice(offset, offset + 50) };
  } else if (url.pathname.startsWith('/authorized_payments/')) value = state.invoices[url.pathname.split('/').at(-1)];
  else if (url.pathname.startsWith('/v1/payments/')) value = state.payments[url.pathname.split('/').at(-1)];
  return Response.json(value ?? { error: 'Unknown fixture resource' }, { status: value ? 200 : 404 });
};
