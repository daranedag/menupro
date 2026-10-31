import { createHmac, timingSafeEqual } from 'node:crypto';

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

export function recurringGross(subscription) {
  const cycle = subscription.billing_cycle;
  let net = cycle === 'annual' ? subscription.annual_net : subscription.monthly_net;
  if (subscription.welcome_redeemed_at && subscription.welcome_cycle === cycle &&
    subscription.welcome_payments_used < (cycle === 'annual' ? 1 : 3)) {
    net = Math.round(net * (cycle === 'annual' ? 0.9 : 0.8));
  }
  return net + Math.round(net * 0.19);
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
