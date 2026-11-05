import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { BusinessClient, BusinessContext } from './business';
import { readJson } from './business';
import { createPublicInsForge } from './insforge';
import { check, HttpError, respond } from './http';
import { escapeHtml, recurringGross, safeCheckoutUrl } from '@/lib/billing.mjs';
import { invitationEmailReady } from './email';
import { validRut } from '@/lib/honorarios.mjs';
import { recoverPayments } from '@/lib/payment-recovery.mjs';
import { collectorMatchesMode, paymentMatchesEnvironment } from '@/lib/payment-environment.mjs';
import { mercadoPagoFailure } from '@/lib/mercadopago-errors.mjs';
import { commercialSettings } from './commercial';
import { downloadFiscalPdf } from './fiscal';

type MpRecord = Record<string, any>;
const providerId = /^[a-zA-Z0-9_-]{1,128}$/;
let collectorCache: { token: string; collector: { id: string; tags: string[] }; expires: number } | undefined;
async function configuredCollector() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
  let collector = collectorCache?.token === token && collectorCache.expires > Date.now() ? collectorCache.collector : null;
  if (!collector) {
    const response = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new HttpError('No se pudo verificar la cuenta vendedora de Mercado Pago.', 503);
    const value = await response.json();
    if (!value.id || !Array.isArray(value.tags)) throw new HttpError('La cuenta vendedora no pudo verificarse.', 503);
    collector = { id: String(value.id), tags: value.tags.includes('test_user') ? ['test_user'] : [] };
    collectorCache = { token, collector, expires: Date.now() + 300000 };
  }
  if (!collectorMatchesMode(collector, process.env.MENUPRO_BILLING_MODE)) throw new HttpError('El modo de prueba requiere una cuenta vendedora de prueba; producción requiere una cuenta real.', 503);
  return collector;
}
export async function checkedPaymentReadiness() {
  const state = paymentReadiness();
  if (!state.ready) return state;
  try { await configuredCollector(); return state; } catch { return { ...state, ready: false }; }
}

export function paymentReadiness() {
  const mode = process.env.MENUPRO_BILLING_MODE || 'disabled';
  return { provider: 'mercadopago', mode, ready: ['test', 'live'].includes(mode) && Boolean(process.env.APP_URL?.startsWith('https://')) &&
    Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET && process.env.MENUPRO_WORKER_SECRET),
    emailEnabled: invitationEmailReady() };
}

export async function mercadoPago(path: string, method = 'GET', data?: unknown, idempotencyKey?: string): Promise<MpRecord> {
  if (!paymentReadiness().ready) throw new HttpError('La contratación con Mercado Pago aún no está habilitada. Contacta a MenuPro.', 503);
  if (!/^\/(preapproval|authorized_payments|v1\/payments|checkout\/preferences)(\/|\?|$)/.test(path)) throw new Error('Invalid provider endpoint');
  await configuredCollector();
  const result = await fetch('https://api.mercadopago.com' + path, { method,
    headers: { Authorization: 'Bearer ' + process.env.MERCADOPAGO_ACCESS_TOKEN, 'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}) },
    body: data ? JSON.stringify(data) : undefined, cache: 'no-store', signal: AbortSignal.timeout(method === 'GET' ? 5000 : 15000) });
  if (!result.ok) {
    const failure = mercadoPagoFailure(result.status, await result.json().catch(() => null));
    console.error('MenuPro Mercado Pago:', { method, resource: path.split('/')[1]?.split('?')[0], ...failure.diagnostic });
    throw new HttpError(failure.message, failure.status);
  }
  return result.json();
}

export async function workerRpc(name: string, args: Record<string, unknown> = {}) {
  if (!process.env.MENUPRO_WORKER_SECRET) throw new HttpError('El servicio de operaciones aún no está configurado.', 503);
  const { data, error } = await createPublicInsForge().database.rpc(name, { p_secret: process.env.MENUPRO_WORKER_SECRET, ...args });
  check(error); return data;
}

async function userRpc(client: BusinessClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.database.rpc(name, args); check(error); return data;
}

export async function handleBillingApi(request: Request, path: string[], client: BusinessClient, user: { id: string; email?: string }, context: BusinessContext) {
  const route = path.join('/');
  if (route === 'billing' && request.method === 'GET') {
    const [plans, payments, checkouts, profile, documents, subscriptionCheckout] = await Promise.all([
      client.database.from('menupro_plans').select('*').order('monthly_net'),
      context.business_role === 'owner' ? client.database.from('menupro_payment_events').select('*').eq('business_id', context.business_id).order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
      context.business_role === 'owner' ? client.database.from('menupro_checkout_requests').select('id,plan_id,cycle,purpose,status,starts_at,gross_amount,checkout_url,provider_id,created_at').eq('business_id', context.business_id).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: [], error: null }),
      client.database.from('menupro_billing_profiles').select('*').eq('business_id', context.business_id).maybeSingle(),
      client.database.from('menupro_fiscal_documents').select('*').eq('business_id', context.business_id).order('created_at', { ascending: false }).limit(100),
      context.business_role === 'owner' && context.subscription.provider_subscription_id ? client.database.from('menupro_checkout_requests')
        .select('id,plan_id,cycle,purpose,status,starts_at,gross_amount,provider_id').eq('business_id', context.business_id)
        .eq('provider_id', context.subscription.provider_subscription_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    [plans, payments, checkouts, profile, documents, subscriptionCheckout].forEach(result => check(result.error));
    return respond({ subscription: context.subscription, plans: plans.data, payments: payments.data, checkouts: checkouts.data,
      subscriptionCheckout: subscriptionCheckout.data, profile: profile.data, documents: documents.data, availability: await commercialSettings(), configuration: await checkedPaymentReadiness() });
  }
  if (context.business_role !== 'owner') throw new HttpError('Solo el propietario puede gestionar los pagos.', 403);
  if (path[1] === 'document' && path.length === 3 && request.method === 'GET') {
    return downloadFiscalPdf(client, path[2], context.business_id);
  }
  if (route === 'billing/profile' && request.method === 'POST') {
    const input = z.object({ rut: z.string().trim().refine(validRut, 'El RUT no es válido.'), legalName: z.string().trim().min(3).max(200),
      address: z.string().trim().min(5).max(250), commune: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254),
      withholdingParty: z.enum(['recipient', 'emitter']) }).strict().parse(await readJson(request));
    return respond(await userRpc(client, 'menupro_save_billing_profile', { p_business_id: context.business_id,
      p_rut: input.rut, p_legal_name: input.legalName, p_address: input.address, p_commune: input.commune, p_email: input.email, p_withholding_party: input.withholdingParty }));
  }
  if (path[1] === 'receipt' && path.length === 3 && request.method === 'GET') {
    const id = z.string().min(1).max(250).parse(path[2]);
    const { data, error } = await client.database.from('menupro_payment_events').select('*').eq('provider_payment_id', id).eq('business_id', context.business_id).maybeSingle(); check(error);
    if (!data) throw new HttpError('Registro de pago no encontrado.', 404);
    const name = context.businesses.find(b => b.id === context.business_id)?.name || 'Negocio';
    const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Registro de pago MenuPro</title><body><h1>Registro de pago del servicio MenuPro</h1><p>Negocio: ${escapeHtml(name)}</p><p>Referencia: ${escapeHtml(id)}</p><p>Monto: ${escapeHtml(String(data.amount))} ${escapeHtml(data.currency)}</p><p>Estado: ${escapeHtml(data.status)}</p><p>Período: ${escapeHtml(data.period_start || 'Pendiente')} — ${escapeHtml(data.period_end || 'Pendiente')}</p><p>Este registro de servicio no sustituye una boleta de honorarios emitida manualmente en el SII.</p></body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'attachment; filename="menupro-registro-de-pago.html"', 'Cache-Control': 'no-store' } });
  }
  if (route === 'billing/quote' && request.method === 'POST') {
    const input = z.object({ planId: z.enum(['local', 'grupo']), cycle: z.enum(['monthly', 'annual']), purpose: z.enum(['subscription', 'upgrade', 'prepaid']).default('subscription') }).strict().parse(await readJson(request));
    return respond(await userRpc(client, 'menupro_quote', { p_business_id: context.business_id, p_plan_id: input.planId, p_cycle: input.cycle, p_purpose: input.purpose }));
  }
  if (route === 'billing/checkout' && request.method === 'POST') {
    if (!paymentReadiness().ready) throw new HttpError('Mercado Pago aún no está habilitado. Tu demo y tus datos se mantienen según su vigencia.', 503);
    const input = z.object({ planId: z.enum(['local', 'grupo']), cycle: z.enum(['monthly', 'annual']), purpose: z.enum(['subscription', 'upgrade']).default('subscription'),
      payerEmail: z.string().trim().email(), acceptRenewal: z.literal(true) }).strict().parse(await readJson(request));
    await configuredCollector();
    const reserved = await userRpc(client, 'menupro_reserve_checkout', { p_business_id: context.business_id, p_plan_id: input.planId,
      p_cycle: input.cycle, p_purpose: input.purpose, p_accept_renewal: true });
    if (reserved.checkout_url) return respond({ url: safeCheckoutUrl(reserved.checkout_url), requestId: reserved.id });
    const origin = process.env.APP_URL;
    if (!origin || new URL(origin).protocol !== 'https:') throw new HttpError('Configura la dirección pública HTTPS antes de contratar.', 503);
    const returnUrl = new URL('/app/dashboard/billing?return=1', origin).href;
    const lease = randomUUID();
    if (!await workerRpc('menupro_claim_checkout', { p_request_id: reserved.id, p_token: lease })) throw new HttpError('La contratación ya se está preparando. Espera un momento y vuelve a consultar.', 409);
    let created;
    try {
    if (input.purpose === 'upgrade') {
      created = await mercadoPago('/checkout/preferences', 'POST', { external_reference: reserved.id,
        items: [{ id: reserved.id, title: 'Mejora de plan MenuPro', quantity: 1, unit_price: reserved.gross_amount, currency_id: 'CLP' }],
        payer: { email: input.payerEmail }, back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
        notification_url: new URL('/api/payments/mercadopago/webhook', origin).href }, reserved.id);
    } else {
      const existing = await mercadoPago('/preapproval/search?external_reference=' + encodeURIComponent(reserved.id));
      created = existing.results?.find((item: MpRecord) => item.external_reference === reserved.id && ['pending', 'authorized'].includes(item.status));
      created ??= await mercadoPago('/preapproval', 'POST', { reason: `MenuPro ${input.planId === 'local' ? 'Local' : 'Grupo'} ${input.cycle === 'annual' ? 'anual' : 'mensual'}`,
        external_reference: reserved.id, payer_email: input.payerEmail, status: 'pending', back_url: returnUrl,
        auto_recurring: { frequency: input.cycle === 'annual' ? 12 : 1, frequency_type: 'months', currency_id: 'CLP',
          transaction_amount: reserved.gross_amount, start_date: new Date(Math.max(Date.parse(reserved.starts_at), Date.now() + 60000)).toISOString() } }, reserved.id);
    }
    const url = safeCheckoutUrl(input.purpose === 'upgrade' && process.env.MENUPRO_BILLING_MODE === 'test' && created.sandbox_init_point ? created.sandbox_init_point : created.init_point);
    await workerRpc('menupro_bind_checkout', { p_request_id: reserved.id, p_provider_id: String(created.id), p_url: url });
    return respond({ url, requestId: reserved.id }, 201);
    } finally { await workerRpc('menupro_release_checkout', { p_request_id: reserved.id, p_token: lease }); }
  }
  if (route === 'billing/cancel' && request.method === 'POST') {
    const id = context.subscription.provider_subscription_id;
    if (id && providerId.test(String(id)) && !context.subscription.cancel_at_period_end) await mercadoPago('/preapproval/' + id, 'PUT', { status: 'cancelled' }, randomUUID());
    await userRpc(client, 'menupro_cancel_subscription', { p_business_id: context.business_id });
    return respond({ message: 'Renovación cancelada. Conservas el acceso hasta terminar el período pagado.' });
  }
  if (route === 'billing/downgrade' && request.method === 'POST') {
    const { restaurantId } = z.object({ restaurantId: z.string().uuid() }).strict().parse(await readJson(request));
    if (!context.restaurants.some(r => r.id === restaurantId && !r.archived_at) || context.subscription.plan_id !== 'grupo') throw new HttpError('Selecciona el restaurante que seguirá activo.');
    const id = context.subscription.provider_subscription_id;
    if (id && providerId.test(String(id))) {
      const old = await mercadoPago('/preapproval/' + id);
      const cycle = context.subscription.billing_cycle;
      const outbox = await workerRpc('menupro_worker_outbox');
      const subscription = outbox.subscriptions.find((s: MpRecord) => s.provider_subscription_id === id);
      if (!subscription) throw new HttpError('No se encontró la suscripción para actualizar.', 409);
      const amount = recurringGross({ ...subscription, monthly_net: 9990, annual_net: 99900 }, old.next_payment_date ?? context.subscription.current_period_end);
      await mercadoPago('/preapproval/' + id, 'PUT', { auto_recurring: { transaction_amount: amount, currency_id: 'CLP' } });
      try { await userRpc(client, 'menupro_schedule_downgrade', { p_business_id: context.business_id, p_restaurant_id: restaurantId }); }
      catch (error) { await mercadoPago('/preapproval/' + id, 'PUT', { auto_recurring: { transaction_amount: old.auto_recurring.transaction_amount, currency_id: 'CLP' } }); throw error; }
    } else await userRpc(client, 'menupro_schedule_downgrade', { p_business_id: context.business_id, p_restaurant_id: restaurantId });
    return respond({ message: 'La reducción se aplicará en la siguiente renovación. Los demás restaurantes se archivarán.' });
  }
  if (route === 'billing/refresh' && request.method === 'POST') {
    const { requestId } = z.object({ requestId: z.string().uuid() }).strict().parse(await readJson(request));
    const { data, error } = await client.database.from('menupro_checkout_requests').select('id,provider_id,purpose').eq('id', requestId).eq('business_id', context.business_id).maybeSingle(); check(error);
    if (!data) throw new HttpError('No hay una contratación para revisar.', 404);
    const result = await runPaymentRecovery(requestId);
    if (result.failures) throw new HttpError('No pudimos conciliar todos los cobros. Se reintentará automáticamente.', 503);
    const refreshed = await client.database.from('menupro_checkout_requests').select('status,starts_at').eq('id', requestId).eq('business_id', context.business_id).single(); check(refreshed.error);
    if (!refreshed.data) throw new HttpError('No hay una contratación para revisar.', 404);
    if (refreshed.data.status === 'authorized') return respond({ message: 'Suscripción autorizada. Primer cobro previsto para el ' +
      new Date(refreshed.data.starts_at).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }) + '. El primer cobro aún no está confirmado; el período pagado se activa cuando Mercado Pago lo aprueba.' });
    if (refreshed.data.status === 'paid') return respond({ message: 'La contratación tiene un pago confirmado. Revisa el período de acceso y el historial de pagos.' });
    return respond({ message: result.checked ? 'Estado consultado. El acceso pagado se activa cuando Mercado Pago confirma el cobro.' : 'La contratación se revisó recientemente o sigue en proceso. Se volverá a consultar automáticamente.' });
  }
  if (route === 'billing/abandon' && request.method === 'POST') {
    const { requestId } = z.object({ requestId: z.string().uuid() }).strict().parse(await readJson(request));
    const { data, error } = await client.database.from('menupro_checkout_requests').select('provider_id,status,purpose').eq('id', requestId).eq('business_id', context.business_id).maybeSingle(); check(error);
    if (!data || !['pending', 'ready'].includes(data.status)) throw new HttpError('La contratación ya no está pendiente.');
    if (data.provider_id && data.purpose === 'subscription') await mercadoPago('/preapproval/' + data.provider_id, 'PUT', { status: 'cancelled' });
    await userRpc(client, 'menupro_abandon_checkout', { p_request_id: requestId }); return respond(null);
  }
  throw new HttpError('Ruta no encontrada.', 404);
}

export async function reconcilePreapproval(id: string) {
  if (!providerId.test(id)) throw new HttpError('Identificador inválido.');
  const subscription = await mercadoPago('/preapproval/' + id);
  const parsed = z.string().uuid().safeParse(subscription.external_reference);
  if (!parsed.success) return;
  const requestId = parsed.data;
  const owned = await workerRpc('menupro_payment_context', { p_request_id: requestId, p_payment_id: '' });
  if (!owned) return;
  await workerRpc('menupro_provider_status', { p_request_id: requestId, p_provider_id: String(subscription.id), p_status: subscription.status });
}

export async function reconcilePayment(id: string, invoice?: MpRecord) {
  if (!providerId.test(id)) throw new HttpError('Identificador inválido.');
  const payment = await mercadoPago('/v1/payments/' + id);
  if (!paymentMatchesEnvironment(payment, await configuredCollector(), process.env.MENUPRO_BILLING_MODE)) throw new HttpError('El pago no pertenece al entorno ni a la cuenta vendedora configurados.', 409);
  if (!Number.isSafeInteger(Number(payment.transaction_amount)) || !Number.isSafeInteger(Number(payment.transaction_amount_refunded ?? 0)) ||
      !Number.isFinite(Date.parse(payment.date_last_updated))) throw new HttpError('Mercado Pago devolvió un importe o una fecha de cobro inválidos.', 409);
  let reference = payment.external_reference;
  if (invoice?.preapproval_id) {
    const subscription = await mercadoPago('/preapproval/' + invoice.preapproval_id);
    reference = subscription.external_reference;
  }
  const parsed = z.string().uuid().safeParse(reference);
  if (!parsed.success) return;
  const requestId = parsed.data;
  const context = await workerRpc('menupro_payment_context', { p_request_id: requestId, p_payment_id: String(payment.id) });
  if (!context) return;
  if (invoice && (String(context.provider_id) !== String(invoice.preapproval_id) || String(invoice.payment?.id) !== String(payment.id))) throw new HttpError('El cobro no corresponde a esta suscripción.', 409);
  // Subscription invoices identify the billing period. A generic payment event
  // alone cannot grant another period; it can still report a refund/chargeback.
  if (context.purpose === 'subscription' && !invoice && !context.credited) return;
  await workerRpc('menupro_apply_payment', { p_request_id: requestId, p_payment_id: String(payment.id),
    p_invoice_id: invoice ? String(invoice.id) : null, p_status: payment.status, p_amount: Math.round(Number(payment.transaction_amount)),
    p_currency: payment.currency_id, p_approved_at: payment.date_approved ?? null, p_modified_at: payment.date_last_updated ?? new Date().toISOString(),
    p_due_at: invoice?.debit_date ?? payment.date_created, p_refunded: Math.round(Number(payment.transaction_amount_refunded ?? 0)) });
}

export async function reconcileInvoice(id: string) {
  if (!providerId.test(id)) throw new HttpError('Identificador inválido.');
  const invoice = await mercadoPago('/authorized_payments/' + id);
  if (invoice.payment?.id) await reconcilePayment(String(invoice.payment.id), invoice);
}

export async function syncRecurringAmounts(onlyId?: string) {
  const outbox = await workerRpc('menupro_worker_outbox');
  for (const subscription of outbox.subscriptions ?? []) {
    const id = String(subscription.provider_subscription_id);
    if (onlyId && id !== onlyId) continue;
    if (!providerId.test(id)) continue;
    const current = await mercadoPago('/preapproval/' + id);
    if (current.status !== 'authorized') continue;
    const amount = recurringGross(subscription, current.next_payment_date ?? subscription.current_period_end ?? new Date());
    if (Number(current.auto_recurring?.transaction_amount) !== amount) {
      await mercadoPago('/preapproval/' + id, 'PUT', { auto_recurring: { transaction_amount: amount, currency_id: 'CLP' } });
    }
  }
}

export function runPaymentRecovery(requestId: string | null = null) {
  return recoverPayments({ rpc: workerRpc, mp: mercadoPago, reconcileInvoice, reconcilePayment, reconcilePreapproval,
    syncAmount: syncRecurringAmounts, uuid: randomUUID, requestId,
    onFailure: (error: unknown, id: string) => console.error('MenuPro conciliación:', id, error instanceof Error ? error.message : 'Error interno') });
}
