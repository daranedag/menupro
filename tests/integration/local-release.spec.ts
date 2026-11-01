import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { account, query, restaurant, session, startTrial } from '../helpers/backend';
const file = '.insforge/payment-fixture.json';
function provider(change: (state: any) => void) { const state = JSON.parse(readFileSync(file, 'utf8')); change(state); writeFileSync(file, JSON.stringify(state)); }

test('Local: demo, public QR, checkout, missed webhook, renewal, rejection, suspension, reactivation and manual honorarium', async ({ page, browser }) => {
  test.setTimeout(300000);
  const customer = await account('local-release'); const outsider = await account('fiscal-outsider'); const admin = await account('fiscal-admin');
  try {
    query(`INSERT INTO public.menupro_admins(email) VALUES('${admin.email}')`);
    const r = await restaurant(customer.context, 'Local completo ' + Date.now());
    expect((await startTrial(customer.context, r)).status()).toBe(200);
    const menuResponse = await customer.context.post('/api/menus', { data: { restaurant_id: r.id, name: 'Carta Local completa' } });
    const menu = (await menuResponse.json()).data;
    expect(menu.id).toBeTruthy();
    expect((await customer.context.patch('/api/menus/' + menu.id + '/publish', { data: { publish: true } })).status()).toBe(200);
    const publicUrl = '/menu/' + r.slug + '/' + menu.slug;
    await page.context().addCookies((await customer.context.storageState()).cookies);
    await page.goto('/app/dashboard/menus/' + menu.id);
    await page.getByRole('button', { name: 'Generar QR' }).click();
    await expect(page.locator('input[readonly]')).toHaveValue(new RegExp('/menu/' + r.slug + '/' + menu.slug + '$'));
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    const anonymous = await browser.newContext(); const publicPage = await anonymous.newPage();
    await publicPage.goto(publicUrl); await expect(publicPage.getByRole('heading', { name: 'Carta Local completa' })).toBeVisible();
    // Start charging only after the demo; no real clock or real money is changed.
    query(`UPDATE public.menupro_subscriptions SET trial_ends_at=now()-interval '1 minute' WHERE business_id='${customer.user.businessId}'`);
    await page.getByRole('link', { name: 'Suscripción', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Datos para la boleta de honorarios' })).toBeVisible();
    await expect(page.getByText('Honorario bruto: $7.992')).toBeVisible();
    await page.getByRole('checkbox', { name: /Autorizo la renovación/ }).check();
    await page.route('https://www.mercadopago.cl/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>Checkout simulado de integración</h1>' }));
    await page.getByRole('button', { name: 'Continuar a Mercado Pago' }).click();
    await expect(page.getByRole('heading', { name: 'Checkout simulado de integración' })).toBeVisible();
    const requestId = query(`SELECT id FROM public.menupro_checkout_requests WHERE business_id='${customer.user.businessId}' ORDER BY created_at DESC LIMIT 1`)[0].id;
    const subscriptionId = 'fixture-' + requestId;
    provider(state => { state.subscriptions[subscriptionId].status = 'authorized'; });
    expect((await customer.context.post('/api/billing/refresh', { data: { requestId } })).status()).toBe(200);
    expect((await session(customer.context)).subscription.has_access).toBe(false);
    expect(JSON.parse(readFileSync(file, 'utf8')).subscriptions[subscriptionId].auto_recurring.transaction_amount).toBe(7992);
    const restore = async () => {
      query(`UPDATE public.menupro_reconciliation_jobs SET last_checked_at=now()-interval '2 minutes',next_attempt_at=now(),lease_until=NULL WHERE request_id='${requestId}'`);
      const response = await customer.context.post('/api/billing/refresh', { data: { requestId } });
      expect(response.status(), await response.text()).toBe(200);
    };
    let sequence = 0;
    const charge = (paymentId: string, status: string, amount = 7992) => provider(state => {
      const modified = new Date(Date.now() + ++sequence * 1000).toISOString();
      state.payments[paymentId] = { id: paymentId, collector_id: 3426677054, external_reference: requestId, status, transaction_amount: amount, currency_id: 'CLP',
        live_mode: false, date_created: modified, date_approved: status === 'approved' ? modified : null, date_last_updated: modified };
      state.invoices[paymentId] = { id: paymentId, preapproval_id: subscriptionId, debit_date: modified, payment: { id: paymentId, status } };
    });
    // No webhook: periodic/owner reconciliation must discover the approved charge.
    charge('release-first-' + requestId, 'approved'); await restore();
    const first = await session(customer.context); expect(first.subscription.has_access).toBe(true); expect(first.subscription.welcome_payments_used).toBe(1);
    await restore(); expect((await session(customer.context)).subscription.current_period_end).toBe(first.subscription.current_period_end);
    query(`UPDATE public.menupro_subscriptions SET current_period_start=now()-interval '1 month',current_period_end=now()-interval '1 hour' WHERE business_id='${customer.user.businessId}'`);
    charge('release-second-' + requestId, 'approved'); await restore();
    expect((await session(customer.context)).subscription.welcome_payments_used).toBe(2);
    charge('release-third-' + requestId, 'rejected'); await restore();
    expect((await session(customer.context)).subscription.effective_status).toBe('past_due');
    query(`UPDATE public.menupro_subscriptions SET current_period_end=now()-interval '8 days',grace_until=now()-interval '1 day' WHERE business_id='${customer.user.businessId}'`);
    expect((await session(customer.context)).subscription.has_access).toBe(false);
    await publicPage.goto(publicUrl); await expect(publicPage.getByRole('heading', { name: 'Carta no disponible temporalmente' })).toBeVisible();
    charge('release-third-' + requestId, 'approved'); await restore();
    const renewed = await session(customer.context); expect(renewed.subscription.has_access).toBe(true); expect(renewed.subscription.welcome_payments_used).toBe(3);
    const state = JSON.parse(readFileSync(file, 'utf8')); expect(state.subscriptions[subscriptionId].auto_recurring.transaction_amount).toBe(9990);
    await publicPage.goto(publicUrl); await expect(publicPage.getByRole('heading', { name: 'Carta Local completa' })).toBeVisible();
    const billing = (await (await customer.context.get('/api/billing')).json()).data;
    expect(billing.documents).toHaveLength(3); expect(billing.documents[0].honorarium_gross).toBe(7992);
    expect((await outsider.sdk.database.from('menupro_fiscal_documents').select('*').eq('business_id', customer.user.businessId)).data).toEqual([]);
    expect((await outsider.context.get('/api/admin/fiscal')).status()).toBe(403);
    const document = billing.documents[0];
    const issuedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
    const issued = await admin.context.post('/api/admin/fiscal/issue', { data: { paymentId: document.payment_id, folio: String(Date.now()), issuedDate } });
    expect(issued.status(), await issued.text()).toBe(200);
    const notices = await customer.sdk.database.from('menupro_notifications').select('subject,recipient_email,email_sent_at').eq('business_id', customer.user.businessId);
    const notice = notices.data?.find((item: any) => item.subject === 'Boleta de honorarios registrada');
    expect(notice?.recipient_email).toBe(customer.email); expect(notice?.email_sent_at).toBeNull();
    const receipt = await customer.context.get('/api/billing/receipt/' + document.payment_id); expect(await receipt.text()).not.toContain('IVA incluido');
    await page.goto('/app/dashboard/billing'); await expect(page.getByText(/Boleta N.º/)).toBeVisible();
    await page.screenshot({ path: 'artifacts/local-release-billing.png', fullPage: true });
    await anonymous.close();
  } finally { await Promise.all([customer.context.dispose(), outsider.context.dispose(), admin.context.dispose()]); }
});

test('recipient withholding is applied in the trusted quote and copied immutably into checkout', async () => {
  const customer = await account('withholder');
  try {
    const response = await customer.context.post('/api/billing/profile', { data: { rut: '11.111.111-1', legalName: 'Empresa receptora',
      address: 'Domicilio tributario 123', commune: 'Santiago', email: customer.email, withholdingParty: 'recipient' } });
    expect(response.status(), await response.text()).toBe(200);
    const result = await customer.sdk.database.rpc('menupro_quote', { p_business_id: customer.user.businessId, p_plan_id: 'local', p_cycle: 'monthly' });
    expect(result.data.honorarium_gross).toBe(9990); expect(result.data.withholding_amount).toBe(1523); expect(result.data.gross_amount).toBe(8467);
    const reserved = await customer.sdk.database.rpc('menupro_reserve_checkout', { p_business_id: customer.user.businessId, p_plan_id: 'local', p_cycle: 'monthly', p_accept_renewal: true });
    expect(reserved.error).toBeNull(); expect(reserved.data.billing_snapshot.withholding_party).toBe('recipient');
    expect((await customer.context.post('/api/billing/profile', { data: { rut: '11.111.111-1', legalName: 'Cambiar receptor', address: 'Otra dirección 123', commune: 'Santiago', email: customer.email, withholdingParty: 'emitter' } })).status()).toBe(409);
  } finally { await customer.context.dispose(); }
});
