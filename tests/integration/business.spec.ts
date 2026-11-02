import { test, expect } from '@playwright/test';
import { account, query, restaurant, session, startTrial, worker } from '../helpers/backend';
test.beforeEach(() => { query('UPDATE public.menupro_commercial_settings SET grupo_enabled=true,annual_enabled=true'); });
test.afterEach(() => { query('UPDATE public.menupro_commercial_settings SET grupo_enabled=false,annual_enabled=false'); });

test('trial identity detects repeated restaurants across accounts without blocking namesakes', async () => {
  test.setTimeout(180000);
  const a = await account('trial-a'); const b = await account('trial-b'); const c = await account('trial-c');
  try {
    const suffix = Date.now();
    const first = await restaurant(a.context, 'Café Prueba ' + suffix);
    const identity = { phone: '+569' + String(suffix).slice(-8), address: 'Avenida Demo ' + suffix, city: 'Santiago', unit: '101' };
    let result = await startTrial(a.context, first, identity);
    expect(result.status(), await result.text()).toBe(200);
    const original = await session(a.context);
    expect(original.subscription.effective_status).toBe('trial');
    expect(original.subscription.first_menu_saved_at).toBeNull();
    const menus = (await (await a.context.get('/api/menus/restaurant/' + first.id)).json()).data;
    expect(menus[0].name).toBe('Carta de ejemplo');
    expect((await a.context.post('/api/restaurants', { data: { name: 'Segundo restaurante' } })).status()).toBe(409);
    result = await startTrial(a.context, first, identity); expect(result.status()).toBe(409);
    expect((await session(a.context)).subscription.trial_ends_at).toBe(original.subscription.trial_ends_at);
    expect((await a.sdk.database.from('menupro_subscriptions').update({ plan_id: 'grupo' }).eq('business_id', original.businessId)).error).toBeTruthy();
    const namesake = await restaurant(c.context, first.name);
    expect(namesake.slug).not.toBe(first.slug);
    result = await startTrial(c.context, namesake, { name: first.name, phone: '+569' + String(suffix + 101).slice(-8), address: 'Otra dirección ' + suffix, city: 'Valdivia', unit: '202' });
    expect(result.status(), await result.text()).toBe(200);
    expect((await session(c.context)).subscription.effective_status).toBe('trial');
    // Simulate an approved closure, including the business and owner. The
    // minimal history must survive both, without leaving an ownerless business.
    query(`DELETE FROM public.menupro_restaurants WHERE business_id='${original.businessId}'; DELETE FROM public.menupro_businesses WHERE id='${original.businessId}'; DELETE FROM auth.users WHERE id='${a.user.id}'`);
    const copy = await restaurant(b.context, 'Otro nombre del local ' + suffix);
    result = await startTrial(b.context, copy, identity);
    expect(result.status(), await result.text()).toBe(200);
    const reviewed = await session(b.context);
    expect(reviewed.subscription.effective_status).toBe('review');
    expect(reviewed.subscription.trial_started_at).toBeNull();
    expect(reviewed.subscription.has_access).toBe(false);
    expect((await b.context.post('/api/menus', { data: { restaurant_id: copy.id, name: 'No autorizada' } })).status()).toBe(403);
    expect((await b.sdk.database.from('menupro_trial_claims').select('*')).error).toBeTruthy();
  } finally { await Promise.all([a.context.dispose(), b.context.dispose(), c.context.dispose()]); }
});

test('invitations are email-bound; transfer preserves subscription and revoked members lose access', async () => {
  test.setTimeout(240000);
  const owner = await account('team-owner'); const editor = await account('team-editor'); const outsider = await account('team-outsider');
  try {
    const r = await restaurant(owner.context, 'Equipo ' + Date.now());
    expect((await startTrial(owner.context, r)).status()).toBe(200);
    const initial = await session(owner.context);
    let response = await owner.context.post('/api/business/invitations', { data: { email: editor.email, role: 'editor' } });
    expect(response.status(), await response.text()).toBe(201);
    const id = (await response.json()).data.id;
    expect((await outsider.context.post('/api/business/invitations/accept', { data: { id } })).status()).toBe(403);
    expect((await editor.context.post('/api/business/invitations/accept', { data: { id } })).status()).toBe(200);
    const invited = await session(editor.context); expect(invited.businessId).toBe(initial.businessId); expect(invited.activeRestaurantId).toBe(r.id);
    expect((await editor.context.post('/api/business/invitations', { data: { email: outsider.email, role: 'manager' } })).status()).toBe(403);
    expect((await editor.context.post('/api/billing/quote', { data: { planId: 'grupo', cycle: 'monthly' } })).status()).toBe(403);
    const menuResponse = await editor.context.post('/api/menus', { data: { restaurant_id: r.id, name: 'Carta del equipo' } });
    expect(menuResponse.status(), await menuResponse.text()).toBe(201);
    const menu = (await menuResponse.json()).data;
    expect((await owner.context.post('/api/business/members', { data: { userId: editor.user.id, action: 'transfer' } })).status()).toBe(200);
    const transferred = await session(editor.context);
    expect(transferred.businessRole).toBe('owner'); expect(transferred.subscription.trial_ends_at).toBe(initial.subscription.trial_ends_at);
    expect((await session(owner.context)).businessRole).toBe('manager');
    expect((await owner.context.post('/api/business/members', { data: { userId: editor.user.id, action: 'remove' } })).status()).toBe(403);
    expect((await editor.context.post('/api/business/members', { data: { userId: owner.user.id, action: 'remove' } })).status()).toBe(200);
    expect((await owner.context.get('/api/menus/' + menu.id)).status()).toBe(404);
    const direct = await owner.sdk.database.from('menupro_menus').select('id').eq('id', menu.id);
    expect(direct.data).toEqual([]);
    query(`DELETE FROM auth.users WHERE id='${owner.user.id}'`);
    expect((await editor.context.get('/api/menus/' + menu.id)).status()).toBe(200);
  } finally { await Promise.all([owner.context.dispose(), editor.context.dispose(), outsider.context.dispose()]); }
});

test('expiry restricts writes and public content while preserving consultation and export', async () => {
  test.setTimeout(180000);
  const a = await account('expiry');
  try {
    const r = await restaurant(a.context, 'Vencimiento ' + Date.now()); expect((await startTrial(a.context, r)).status()).toBe(200);
    let response = await a.context.post('/api/menus', { data: { restaurant_id: r.id, name: 'Mi carta' } });
    expect(response.status()).toBe(201); const menu = (await response.json()).data;
    expect((await a.context.patch('/api/menus/' + menu.id + '/publish', { data: { publish: true } })).status()).toBe(200);
    const url = '/api/menus/public/' + r.slug + '/' + menu.slug;
    expect((await (await a.context.get(url)).json()).data.menu.name).toBe('Mi carta');
    query(`UPDATE public.menupro_subscriptions SET trial_ends_at=now()-interval '1 second' WHERE business_id='${a.user.businessId}'`);
    expect((await session(a.context)).subscription.has_access).toBe(false);
    expect((await a.context.get('/api/menus/' + menu.id)).status()).toBe(200);
    expect((await a.context.get('/api/business/export')).status()).toBe(200);
    expect((await a.context.patch('/api/menus/' + menu.id, { data: { name: 'Edición bloqueada' } })).status()).toBe(404);
    expect((await a.context.post('/api/business/export-pdf', { data: { menuId: menu.id } })).status()).toBe(403);
    expect((await (await a.context.get(url)).json()).data).toEqual({ unavailable: true });
    const page = await a.context.get('/menu/' + r.slug + '/' + menu.slug);
    expect(await page.text()).toContain('Carta no disponible temporalmente');
    const direct = await a.sdk.database.from('menupro_menus').update({ name: 'No debe cambiar' }).eq('id', menu.id).select('id');
    expect(direct.data ?? []).toEqual([]);
    expect((await a.sdk.database.rpc('menupro_reorder_sections', { p_menu_id: menu.id, p_ids: [] })).error).toBeTruthy();
  } finally { await a.context.dispose(); }
});

test('payment approval is trusted and idempotent; discounts expire and grace does not require a cron', async () => {
  test.setTimeout(240000);
  const a = await account('payment'); const rpc = worker();
  try {
    const r = await restaurant(a.context, 'Pagos ' + Date.now()); expect((await startTrial(a.context, r)).status()).toBe(200);
    const saved = await a.context.post('/api/menus', { data: { restaurant_id: r.id, name: 'Carta guardada' } }); expect(saved.status()).toBe(201);
    const quote = await a.context.post('/api/billing/quote', { data: { planId: 'local', cycle: 'monthly' } });
    const quoted = (await quote.json()).data; expect(quoted.net_amount).toBe(7992); expect(quoted.welcome).toBe(true);
    query(`UPDATE public.menupro_subscriptions SET trial_ends_at=now()-interval '1 hour' WHERE business_id='${a.user.businessId}'`);
    const reserved = await a.sdk.database.rpc('menupro_reserve_checkout', { p_business_id: a.user.businessId, p_plan_id: 'local', p_cycle: 'monthly', p_accept_renewal: true });
    expect(reserved.error).toBeNull(); const checkout = reserved.data;
    const provider = 'test-' + checkout.id;
    await rpc('menupro_bind_checkout', { p_request_id: checkout.id, p_provider_id: provider, p_url: 'https://www.mercadopago.cl/test' });
    await rpc('menupro_provider_status', { p_request_id: checkout.id, p_provider_id: provider, p_status: 'authorized' });
    expect((await session(a.context)).subscription.has_access).toBe(false);
    const denied = await a.sdk.database.rpc('menupro_apply_payment', { p_secret: 'x'.repeat(64), p_request_id: checkout.id, p_payment_id: 'forged', p_invoice_id: 'forged', p_status: 'approved', p_amount: 7992,
      p_currency: 'CLP', p_approved_at: new Date().toISOString(), p_modified_at: new Date().toISOString(), p_due_at: new Date().toISOString() });
    expect(denied.error).toBeTruthy();
    const now = new Date().toISOString();
    const event = { p_request_id: checkout.id, p_payment_id: 'test-payment-' + checkout.id, p_invoice_id: 'invoice-' + checkout.id,
      p_status: 'approved', p_amount: 7992, p_currency: 'CLP', p_approved_at: now, p_modified_at: now, p_due_at: now };
    await rpc('menupro_apply_payment', event);
    const first = await session(a.context); expect(first.subscription.has_access).toBe(true); expect(first.subscription.welcome_payments_used).toBe(1);
    const upgrade = await a.sdk.database.rpc('menupro_quote', { p_business_id: a.user.businessId, p_plan_id: 'grupo', p_cycle: 'monthly', p_purpose: 'upgrade' });
    expect(upgrade.error).toBeNull(); expect(upgrade.data.net_amount).toBeGreaterThan(11990); expect(upgrade.data.net_amount).toBeLessThanOrEqual(12000);
    await rpc('menupro_apply_payment', event);
    const repeat = await session(a.context); expect(repeat.subscription.current_period_end).toBe(first.subscription.current_period_end); expect(repeat.subscription.welcome_payments_used).toBe(1);
    for (let i = 2; i <= 4; i++) await rpc('menupro_apply_payment', { ...event, p_payment_id: event.p_payment_id + '-' + i, p_invoice_id: event.p_invoice_id + '-' + i, p_amount: i <= 3 ? 7992 : 9990 });
    expect((await session(a.context)).subscription.welcome_payments_used).toBe(4);
    query(`UPDATE public.menupro_subscriptions SET current_period_start=now()-interval '1 month',current_period_end=now()-interval '1 day',grace_until=NULL,status='active' WHERE business_id='${a.user.businessId}'`);
    expect((await session(a.context)).subscription.has_access).toBe(true);
    const graceBefore = await session(a.context);
    await rpc('menupro_apply_payment', { ...event, p_payment_id: event.p_payment_id + '-grace', p_invoice_id: event.p_invoice_id + '-grace', p_amount: 9990 });
    const graceAfter = await session(a.context);
    expect(graceAfter.subscription.current_period_start).toBe(graceBefore.subscription.current_period_end);
    query(`UPDATE public.menupro_subscriptions SET current_period_end=now()-interval '8 days' WHERE business_id='${a.user.businessId}'`);
    expect((await session(a.context)).subscription.has_access).toBe(false);
  } finally { await a.context.dispose(); }
});
