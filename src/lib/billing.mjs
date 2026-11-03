import { createHmac, timingSafeEqual } from 'node:crypto';
import { honorariumAmounts } from './honorarios.mjs';

export function verifyMercadoPagoSignature({ signature, requestId, dataId, secret, now = Date.now() }) {
  if (!secret || !signature || !requestId || !dataId || requestId.length > 200) return false;
  const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
  if (!/^\d{10,13}$/.test(parts.ts ?? '') || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? '')) return false;
  const timestamp = Number(parts.ts) * (parts.ts.length <= 10 ? 1000 : 1);
  if (Math.abs(now - timestamp) > 600000) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'));
}

export function recurringGross(subscription, date = new Date()) {
  const cycle = subscription.billing_cycle;
  let net = cycle === 'annual' ? subscription.annual_net : subscription.monthly_net;
  const welcome = subscription.checkout_welcome ?? Boolean(subscription.welcome_redeemed_at);
  const welcomeCycle = subscription.welcome_cycle ?? (welcome ? cycle : null);
  const monthlyPayments = subscription.monthly_welcome_payments ?? 3;
  const monthlyPercent = subscription.monthly_welcome_percent ?? 20;
  if (welcome && welcomeCycle === cycle &&
    subscription.welcome_payments_used < (cycle === 'annual' ? 1 : monthlyPayments)) {
    net = Math.round(net * (cycle === 'annual' ? 0.9 : (100 - monthlyPercent) / 100));
  }
  return subscription.tax_mode === 'honorarios'
    ? honorariumAmounts(net, subscription.billing_snapshot.withholding_party, date).gross_amount
    : net + Math.round(net * 0.19);
}

export function safeCheckoutUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/(^|\.)mercadopago\.(cl|com|com\.ar|com\.br|com\.mx)$/.test(url.hostname)) {
    throw new Error('Mercado Pago devolvió una dirección de pago inválida.');
  }
  return url.href;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
