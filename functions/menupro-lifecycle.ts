// Runs on InsForge, with no broad database credential in the Next.js app.
import { createClient } from 'npm:@insforge/sdk@1.5.2';

const json = (body: unknown, status = 200) => Response.json(body, { status });

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
  let markFailure: (() => Promise<unknown>) | undefined;
  try {
    const baseUrl = Deno.env.get('MENUPRO_BACKEND_URL')!;
    const client = createClient({ baseUrl, anonKey: Deno.env.get('ANON_KEY'), isServerMode: true });
    const rpc = async (name: string, args = {}) => {
      const { data, error } = await client.database.rpc(name, { p_secret: secret, ...args });
      if (error) throw new Error('Operation failed: ' + name); return data;
    };
    markFailure = () => rpc('menupro_record_heartbeat', { p_phase: 'finished', p_ok: false });
    await rpc('menupro_record_heartbeat', { p_phase: 'started' });
    const lifecycle = await rpc('menupro_run_lifecycle');
    const expiredHistory = await rpc('menupro_expire_abuse_history');
    let emailed = 0; let emailFailures = 0;
    let deferred = 0;
    let emailDispatchFailed = false; let paymentDispatchFailed = false;
    const errors: string[] = [];
    // Provider credentials and reconciliation stay in the Next.js payment service.
    let paymentResult = { checked: 0, recovered: 0, failures: 0 };
    await Promise.all([
      (async () => {
        if (Deno.env.get('MENUPRO_EMAIL_ENABLED') !== 'true') return;
        try {
          const app = new URL(Deno.env.get('MENUPRO_APP_URL') || '');
          if (app.protocol !== 'https:') throw new Error('MenuPro email delivery requires HTTPS');
          const response = await fetch(new URL('/api/internal/notifications', app), { method: 'POST',
            headers: { 'x-menupro-worker-secret': secret }, redirect: 'error', signal: AbortSignal.timeout(55000) });
          if (!response.ok) throw new Error('Resend notification delivery failed: ' + response.status);
          const result = await response.json();
          emailed = result.emailed; emailFailures = result.emailFailures; deferred = result.deferred;
        } catch { emailDispatchFailed = true; errors.push('No se completó el envío de avisos.'); }
      })(),
      (async () => {
        if (!['test', 'live'].includes(Deno.env.get('MENUPRO_BILLING_MODE') || '')) return;
        try {
          const app = new URL(Deno.env.get('MENUPRO_APP_URL') || '');
          if (app.protocol !== 'https:') throw new Error('Payment reconciliation requires HTTPS');
          const response = await fetch(new URL('/api/internal/payments', app), { method: 'POST',
            headers: { 'x-menupro-worker-secret': secret }, redirect: 'error', signal: AbortSignal.timeout(55000) });
          if (!response.ok) throw new Error('Payment reconciliation failed: ' + response.status);
          paymentResult = await response.json();
        } catch { paymentDispatchFailed = true; errors.push('No se completó la conciliación de pagos.'); }
      })(),
    ]);
    const ok = !emailDispatchFailed && !paymentDispatchFailed && emailFailures === 0 && paymentResult.failures === 0;
    await rpc('menupro_record_heartbeat', { p_phase: 'finished', p_ok: ok,
      p_summary: { email_failures: emailFailures + Number(emailDispatchFailed), payment_failures: paymentResult.failures + Number(paymentDispatchFailed) } });
    // Independent monitoring also invokes this endpoint if this job stops running.
    try {
      const app = new URL(Deno.env.get('MENUPRO_APP_URL') || '');
      if (app.protocol !== 'https:') throw new Error('HTTPS required');
      const response = await fetch(new URL('/api/internal/operations', app), { method: 'POST',
        headers: { 'x-menupro-worker-secret': secret }, redirect: 'error', signal: AbortSignal.timeout(40000) });
      if (!response.ok) errors.push('No se completó la comprobación de alertas.');
    } catch { errors.push('No se completó la comprobación de alertas.'); }
    return json({ ...lifecycle, expiredHistory, emailed, emailFailures, deferred, payments: paymentResult, errors }, ok && errors.length === 0 ? 200 : 503);
  } catch (error) {
    try { await markFailure?.(); } catch { /* The external watchdog detects a missing heartbeat. */ }
    console.error(error instanceof Error ? error.message : 'MenuPro lifecycle failed');
    return json({ error: 'No se pudo completar el mantenimiento de MenuPro.' }, 500);
  }
}
