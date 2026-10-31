// Runs on InsForge, with no broad database credential in the Next.js app.
import { createClient, createAdminClient } from 'npm:@insforge/sdk@1.5.2';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export default async function(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  const secret = Deno.env.get('MENUPRO_WORKER_SECRET');
  const supplied = request.headers.get('x-menupro-worker-secret');
  if (!secret || !supplied || supplied.length !== secret.length) return json({ error: 'No autorizado.' }, 401);
  const hash = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [a, b] = await Promise.all([hash(secret), hash(supplied)]);
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  if (difference !== 0) return json({ error: 'No autorizado.' }, 401);
  try {
    const baseUrl = Deno.env.get('MENUPRO_BACKEND_URL')!;
    const client = createClient({ baseUrl, anonKey: Deno.env.get('ANON_KEY'), isServerMode: true });
    const rpc = async (name: string, args = {}) => {
      const { data, error } = await client.database.rpc(name, { p_secret: secret, ...args });
      if (error) throw new Error('Operation failed: ' + name); return data;
    };
    const lifecycle = await rpc('menupro_run_lifecycle');
    const expiredHistory = await rpc('menupro_expire_abuse_history');
    let emailed = 0; let emailFailures = 0;
    if (Deno.env.get('MENUPRO_EMAIL_ENABLED') === 'true') {
      const apiKey = Deno.env.get('API_KEY');
      if (!apiKey) throw new Error('Email service credential is not configured');
      const mail = createAdminClient({ baseUrl, apiKey });
      const notices = await rpc('menupro_claim_notifications');
      for (const notice of notices) {
        try {
          const { data, error } = await mail.emails.send({ to: notice.email, from: 'MenuPro', subject: notice.subject,
            html: `<p>${escape(notice.message)}</p><p>Ingresa a tu cuenta de MenuPro para revisar los detalles.</p>` });
          const skipped = (data as { skipped?: string[] } | null)?.skipped ?? [];
          const sent = !error && !skipped.includes(notice.email);
          await rpc('menupro_complete_notification', { p_notification_id: notice.id, p_token: notice.token, p_sent: sent });
          if (sent) emailed++; else emailFailures++;
        } catch { emailFailures++; await rpc('menupro_complete_notification', { p_notification_id: notice.id, p_token: notice.token, p_sent: false }); }
      }
    }
    // Reconcile the next recurring amount after the introductory discount ends,
    // after an upgrade, or when the owner schedules a downgrade.
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (mpToken && ['test', 'live'].includes(Deno.env.get('MENUPRO_BILLING_MODE') || '')) {
      const outbox = await rpc('menupro_worker_outbox');
      const mp = async (path: string, body?: unknown) => {
        const response = await fetch('https://api.mercadopago.com' + path, { method: body ? 'PUT' : 'GET',
          headers: { Authorization: 'Bearer ' + mpToken, 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error('Payment reconciliation failed'); return response.json();
      };
      for (const s of outbox.subscriptions) {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(s.provider_subscription_id)) continue;
        const existing = await mp('/preapproval/' + s.provider_subscription_id);
        if (existing.status !== 'authorized') continue;
        let net = s.billing_cycle === 'annual' ? s.annual_net : s.monthly_net;
        if (s.welcome_redeemed_at && s.welcome_cycle === s.billing_cycle && s.welcome_payments_used < (s.billing_cycle === 'annual' ? 1 : 3)) net = Math.round(net * (s.billing_cycle === 'annual' ? .9 : .8));
        const gross = net + Math.round(net * .19);
        if (Number(existing.auto_recurring.transaction_amount) !== gross) await mp('/preapproval/' + s.provider_subscription_id, { auto_recurring: { transaction_amount: gross, currency_id: 'CLP' } });
      }
    }
    return json({ ...lifecycle, expiredHistory, emailed, emailFailures });
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'MenuPro lifecycle failed');
    return json({ error: 'No se pudo completar el mantenimiento de MenuPro.' }, 500);
  }
}
