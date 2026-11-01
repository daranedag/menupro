import { test, expect } from '@playwright/test';
import { account, query, restaurant, session, startTrial, worker } from '../helpers/backend';

test('administrators review duplicates, grant expiring courtesies and prepare unstarted demos', async () => {
  test.setTimeout(240000);
  const admin = await account('operations-admin'); const a = await account('operations-a'); const b = await account('operations-b');
  try {
    query(`INSERT INTO public.menupro_admins(email) VALUES('${admin.email}')`);
    const suffix = Date.now(); const identity = { phone: '+569' + String(suffix).slice(-8), address: 'Local prueba ' + suffix, city: 'Santiago', unit: 'A' };
    const first = await restaurant(a.context, 'Administración ' + suffix); expect((await startTrial(a.context, first, identity)).status()).toBe(200);
    const duplicate = await restaurant(b.context, 'Local duplicado ' + suffix); expect((await startTrial(b.context, duplicate, identity)).status()).toBe(200);
    expect((await b.context.get('/api/admin/overview')).status()).toBe(403);
    let response = await admin.context.get('/api/admin/overview'); expect(response.status(), await response.text()).toBe(200);
    const claim = (await response.json()).data.claims.find((item: any) => item.business_id === b.user.businessId);
    expect(claim.id).toBeTruthy();
    response = await admin.context.post('/api/admin/claim', { data: { claimId: claim.id } }); expect(response.status(), await response.text()).toBe(200);
    expect((await response.json()).data.matches.length).toBeGreaterThan(0);
    response = await admin.context.post('/api/admin/review', { data: { claimId: claim.id, approve: true, reason: 'Excepción verificada de prueba aislada.' } });
    expect(response.status(), await response.text()).toBe(200);
    const reviewed = await session(b.context); expect(reviewed.subscription.effective_status).toBe('trial'); expect(reviewed.subscription.first_menu_saved_at).toBeNull();
    const menus = (await (await b.context.get('/api/menus/restaurant/' + duplicate.id)).json()).data; expect(menus[0].name).toBe('Carta de ejemplo');
    response = await admin.context.post('/api/admin/courtesy', { data: { businessId: a.user.businessId, planId: 'grupo', days: 1, reason: 'Prueba de cortesía con vencimiento.' } });
    expect(response.status(), await response.text()).toBe(200); expect((await session(a.context)).maxRestaurants).toBe(3);
    const second = await restaurant(a.context, 'Cortesía dos ' + suffix); await restaurant(a.context, 'Cortesía tres ' + suffix);
    query(`UPDATE public.menupro_subscriptions SET courtesy_until=now()-interval '1 second' WHERE business_id='${a.user.businessId}'`);
    const reverted = await session(a.context); expect(reverted.subscription.plan_id).toBe('local'); expect(reverted.maxRestaurants).toBe(1);
    expect((await a.context.post('/api/menus', { data: { restaurant_id: second.id, name: 'Fuera de cortesía' } })).status()).toBe(403);
    response = await admin.context.post('/api/admin/prepare', { data: { name: 'Demo preparada ' + suffix, email: b.email } }); expect(response.status()).toBe(201);
    const prepared = (await response.json()).data;
    expect((await (await admin.context.get('/api/admin/overview')).json()).data.businesses.find((item: any) => item.id === prepared.businessId).trial_ends_at).toBeNull();
    expect((await b.context.post('/api/business/invitations/accept', { data: { id: prepared.invitationId } })).status()).toBe(200);
    const accepted = await session(b.context); expect(accepted.businessId).toBe(prepared.businessId); expect(accepted.subscription.trial_started_at).toBeNull();
  } finally { await Promise.all([admin.context.dispose(), a.context.dispose(), b.context.dispose()]); }
});

test('prepaid transfers preserve demo days, apply welcome pricing and reject duplicate receipts', async () => {
  test.setTimeout(180000);
  const admin = await account('bank-admin'); const customer = await account('bank-client');
  try {
    query(`INSERT INTO public.menupro_admins(email) VALUES('${admin.email}')`);
    const r = await restaurant(customer.context, 'Transferencia ' + Date.now()); expect((await startTrial(customer.context, r)).status()).toBe(200);
    expect((await customer.context.post('/api/menus', { data: { restaurant_id: r.id, name: 'Carta propia' } })).status()).toBe(201);
    const before = await session(customer.context);
    const payload = { businessId: customer.user.businessId, planId: 'local', cycle: 'monthly', reference: 'BANK-' + Date.now(), reason: 'Transferencia verificada en prueba aislada.', grossAmount: 7992 };
    expect((await customer.context.post('/api/admin/prepaid', { data: payload })).status()).toBe(403);
    expect((await admin.context.post('/api/admin/prepaid', { data: { ...payload, grossAmount: 9500 } })).status()).toBe(409);
    let response = await admin.context.post('/api/admin/prepaid', { data: payload }); expect(response.status(), await response.text()).toBe(200);
    expect((await response.json()).data.gross_amount).toBe(7992);
    const after = await session(customer.context); expect(after.subscription.current_period_start).toBe(before.subscription.trial_ends_at);
    expect(after.subscription.cancel_at_period_end).toBe(true); expect(after.subscription.welcome_payments_used).toBe(1);
    expect((await admin.context.post('/api/admin/prepaid', { data: payload })).status()).toBe(409);
    response = await customer.context.get('/api/billing/receipt/' + encodeURIComponent('bank:' + payload.reference));
    expect(response.status(), await response.text()).toBe(200); expect(await response.text()).toContain('no sustituye una boleta');
  } finally { await Promise.all([admin.context.dispose(), customer.context.dispose()]); }
});

test('a paid downgrade archives the other restaurants; chargeback resolution never credits twice', async () => {
  test.setTimeout(240000);
  const a = await account('downgrade'); const rpc = worker();
  try {
    const first = await restaurant(a.context, 'Reducción uno ' + Date.now()); expect((await startTrial(a.context, first)).status()).toBe(200);
    expect((await a.context.post('/api/menus', { data: { restaurant_id: first.id, name: 'Carta propia' } })).status()).toBe(201);
    query(`UPDATE public.menupro_subscriptions SET trial_ends_at=now()-interval '1 hour' WHERE business_id='${a.user.businessId}'`);
    const reserved = await a.sdk.database.rpc('menupro_reserve_checkout', { p_business_id: a.user.businessId, p_plan_id: 'grupo', p_cycle: 'monthly', p_accept_renewal: true });
    expect(reserved.error).toBeNull(); const checkout = reserved.data;
    const provider = 'test-' + checkout.id;
    await rpc('menupro_bind_checkout', { p_request_id: checkout.id, p_provider_id: provider, p_url: 'https://www.mercadopago.cl/test' });
    await rpc('menupro_provider_status', { p_request_id: checkout.id, p_provider_id: provider, p_status: 'authorized' });
    const event = { p_request_id: checkout.id, p_payment_id: 'group-' + checkout.id, p_invoice_id: 'group-invoice-' + checkout.id,
      p_status: 'approved', p_amount: 19992, p_currency: 'CLP', p_approved_at: new Date().toISOString(), p_modified_at: new Date().toISOString(), p_due_at: new Date().toISOString() };
    await rpc('menupro_apply_payment', event);
    const second = await restaurant(a.context, 'Reducción dos ' + Date.now()); await restaurant(a.context, 'Reducción tres ' + Date.now());
    expect((await a.context.post('/api/restaurants', { data: { name: 'Cuarto bloqueado' } })).status()).toBe(409);
    const scheduled = await a.sdk.database.rpc('menupro_schedule_downgrade', { p_business_id: a.user.businessId, p_restaurant_id: second.id }); expect(scheduled.error).toBeNull();
    const before = await session(a.context); expect(before.subscription.plan_id).toBe('grupo'); expect(before.restaurants.filter((r: any) => !r.archived_at)).toHaveLength(3);
    const next = { ...event, p_payment_id: event.p_payment_id + '-local', p_invoice_id: event.p_invoice_id + '-local', p_amount: 7992 };
    await rpc('menupro_apply_payment', next);
    const reduced = await session(a.context); expect(reduced.subscription.plan_id).toBe('local');
    expect(reduced.restaurants.filter((r: any) => !r.archived_at).map((r: any) => r.id)).toEqual([second.id]);
    const denied = await a.sdk.database.rpc('menupro_archive_restaurant', { p_restaurant_id: first.id, p_archive: false }); expect(denied.error).toBeTruthy();
    const modified = Date.now();
    await rpc('menupro_apply_payment', { ...next, p_status: 'charged_back', p_modified_at: new Date(modified + 1000).toISOString() });
    expect((await session(a.context)).subscription.has_access).toBe(false);
    await rpc('menupro_apply_payment', { ...next, p_modified_at: new Date(modified + 2000).toISOString() });
    const resolved = await session(a.context); expect(resolved.subscription.has_access).toBe(true);
    expect(resolved.subscription.current_period_end).toBe(reduced.subscription.current_period_end);
    expect(resolved.subscription.welcome_payments_used).toBe(reduced.subscription.welcome_payments_used);
    await rpc('menupro_apply_payment', { ...next, p_status: 'refunded', p_refunded: 7992, p_modified_at: new Date(modified + 3000).toISOString() });
    expect((await session(a.context)).subscription.has_access).toBe(false);
  } finally { await a.context.dispose(); }
});

test('retention requires a delivered advance notice and expires abuse signals after 24 months', async () => {
  test.setTimeout(180000);
  const a = await account('retention'); const rpc = worker();
  try {
    const r = await restaurant(a.context, 'Retención ' + Date.now()); expect((await startTrial(a.context, r)).status()).toBe(200);
    query(`UPDATE public.menupro_subscriptions SET trial_started_at=now()-interval '200 days',trial_ends_at=now()-interval '185 days' WHERE business_id='${a.user.businessId}'`);
    await rpc('menupro_run_lifecycle', {});
    expect(query(`SELECT count(*)::int AS total FROM public.menupro_menus WHERE restaurant_id='${r.id}'`)[0].total).toBe(1);
    const notice = query(`SELECT id FROM public.menupro_notifications WHERE business_id='${a.user.businessId}' AND event_key LIKE 'retention_%'`)[0];
    expect(notice.id).toBeTruthy();
    query(`UPDATE public.menupro_subscriptions SET retention_notice_at=now()-interval '31 days' WHERE business_id='${a.user.businessId}'`);
    await rpc('menupro_run_lifecycle', {});
    expect(query(`SELECT count(*)::int AS total FROM public.menupro_menus WHERE restaurant_id='${r.id}'`)[0].total).toBe(1);
    query(`UPDATE public.menupro_notifications SET email_sent_at=now()-interval '31 days' WHERE id='${notice.id}'`);
    await rpc('menupro_run_lifecycle', {});
    expect(query(`SELECT count(*)::int AS total FROM public.menupro_menus WHERE restaurant_id='${r.id}'`)[0].total).toBe(0);
    expect(query(`SELECT count(*)::int AS total FROM public.menupro_trial_claims WHERE business_id='${a.user.businessId}'`)[0].total).toBe(1);
    query(`UPDATE public.menupro_trial_claims SET last_activity_at=now()-interval '25 months' WHERE business_id='${a.user.businessId}'`);
    await rpc('menupro_expire_abuse_history', {});
    expect(query(`SELECT count(*)::int AS total FROM public.menupro_trial_claims WHERE business_id='${a.user.businessId}'`)[0].total).toBe(0);
  } finally { await a.context.dispose(); }
});
