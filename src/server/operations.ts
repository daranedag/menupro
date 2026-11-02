import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { workerRpc } from './billing';
import { emailConfiguration } from './email';
import { emailEscape, resendReady, sendResendEmail } from '@/lib/resend-email.mjs';
import type { BusinessClient } from './business';
import { check } from './http';

export function operationsAuthorized(request: Request) {
  const worker = process.env.MENUPRO_WORKER_SECRET;
  if (!worker) return false;
  const monitor = createHmac('sha256', worker).update('menupro/operations-monitor/v1').digest('hex');
  const supplied = request.headers.get('x-menupro-monitor-secret');
  const internal = request.headers.get('x-menupro-worker-secret');
  const equal = (a: string | null, b: string) => Boolean(a && a.length < 513 && timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest()));
  return equal(supplied, monitor) ? 'external' : equal(internal, worker) ? 'worker' : false;
}

export async function checkOperations() {
  const status = await workerRpc('menupro_check_operations');
  const config = emailConfiguration();
  const to = process.env.RESEND_ADMIN_EMAIL || process.env.RESEND_REPLY_TO;
  let alerted = 0; let failures = 0;
  if (!to || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to) || !resendReady(config)) return { ...status, alertsReady: false, alerted, failures };
  const started = Date.now();
  for (let index = 0; index < 5 && Date.now() - started < 30000; index++) {
    const alert = await workerRpc('menupro_claim_operational_alert');
    if (!alert) break;
    const url = new URL('/app/dashboard/admin', process.env.APP_URL || 'https://www.menupro.cl').href;
    const result = await sendResendEmail({ to, subject: alert.subject, text: alert.message + '\n\n' + url,
      html: `<div lang="es" style="font-family:Arial,sans-serif;color:#0f172a;padding:24px"><h1>${emailEscape(alert.subject)}</h1><p>${emailEscape(alert.message)}</p><p><a href="${emailEscape(url)}">Revisar administración de MenuPro</a></p></div>`,
      idempotencyKey: `menupro-operations/${alert.id}` }, config);
    await workerRpc('menupro_complete_operational_alert', { p_id: alert.id, p_token: alert.claim_token, p_email_id: result.emailId ?? null });
    if (result.emailSent) alerted++; else { failures++; break; }
    await new Promise(resolve => setTimeout(resolve, 650));
  }
  return { ...status, alertsReady: true, alerted, failures };
}

export async function adminOperations(client: BusinessClient) {
  const [heartbeat, incidents, alerts] = await Promise.all([
    client.database.from('menupro_operation_heartbeat').select('*').eq('id', true).single(),
    client.database.from('menupro_operational_incidents').select('*').order('opened_at', { ascending: false }).limit(100),
    client.database.from('menupro_operational_alerts').select('id,subject,transition,created_at,accepted_at,attempts').order('created_at', { ascending: false }).limit(50),
  ]);
  [heartbeat, incidents, alerts].forEach(result => check(result.error));
  return { heartbeat: heartbeat.data, incidents: incidents.data, alerts: alerts.data,
    recipient: process.env.RESEND_ADMIN_EMAIL || process.env.RESEND_REPLY_TO || '',
    resendReady: resendReady(emailConfiguration()), deliveryWebhooksReady: Boolean(process.env.RESEND_WEBHOOK_SECRET) };
}
