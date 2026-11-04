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

const operationDate = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' });
const recipient = () => process.env.RESEND_ADMIN_EMAIL || 'daranedag@gmail.com';

export async function checkOperations({ sendDigest = false } = {}) {
  const status = await workerRpc('menupro_check_operations');
  const config = emailConfiguration();
  const to = recipient();
  const alertsReady = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to) && resendReady(config);
  const resultStatus = { ...status, alertsReady, alerted: 0, failures: 0 };
  if (!sendDigest || !alertsReady) return resultStatus;
  const digest = await workerRpc('menupro_claim_operations_digest');
  if (!digest) return resultStatus;

  const subject = `MenuPro · Resumen operativo del ${digest.report_date}`;
  const url = new URL('/app/dashboard/admin/alertas', process.env.APP_URL || 'https://www.menupro.cl').href;
  const { changes, open, change_count: changeCount } = digest.payload as {
    changes: { subject: string; created_at: string }[];
    open: { summary: string; opened_at: string }[];
    change_count: number;
  };
  const lines = [
    'Corte diario a las 17:00, hora de Santiago.',
    '',
    `Alertas y recuperaciones pendientes de informar: ${changeCount}`,
    ...changes.map(change => `• ${operationDate.format(new Date(change.created_at))} · ${change.subject}`),
    ...(changeCount > changes.length ? ['Consulta el historial para ver el resto de los cambios.'] : []),
    '',
    `Incidentes abiertos al cierre: ${open.length}`,
    ...open.map(incident => `• ${incident.summary} · Desde ${operationDate.format(new Date(incident.opened_at))}`),
  ];
  const result = await sendResendEmail({ to, subject, text: [...lines, '', url].join('\n'),
    html: `<div lang="es" style="font-family:Arial,sans-serif;color:#0f172a;padding:24px"><h1>${emailEscape(subject)}</h1><p>${lines.map(emailEscape).join('<br>')}</p><p><a href="${emailEscape(url)}">Ver alertas operativas</a></p></div>`,
    idempotencyKey: `menupro-operations-digest/${digest.report_date}` }, config);
  await workerRpc('menupro_complete_operations_digest', { p_day: digest.report_date, p_token: digest.claim_token, p_email_id: result.emailId ?? null });
  return { ...resultStatus, alerted: result.emailSent ? 1 : 0, failures: result.emailSent ? 0 : 1 };
}

export async function adminOperations(client: BusinessClient, offset: number) {
  const [heartbeat, active, alerts, digests] = await Promise.all([
    client.database.from('menupro_operation_heartbeat').select('*').eq('id', true).single(),
    client.database.from('menupro_operational_incidents').select('*').is('resolved_at', null).order('opened_at', { ascending: false }).limit(100),
    client.database.from('menupro_operational_alerts').select('id,subject,message,transition,created_at,accepted_at,digest_date,details_snapshot,incident:menupro_operational_incidents(*)')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 50),
    client.database.from('menupro_operational_digests').select('report_date,attempts,accepted_at').order('report_date', { ascending: false }).limit(7),
  ]);
  [heartbeat, active, alerts, digests].forEach(result => check(result.error));
  return { heartbeat: heartbeat.data, incidents: active.data, alerts: alerts.data?.slice(0, 50),
    hasMore: (alerts.data?.length ?? 0) > 50, digests: digests.data,
    recipient: recipient(), resendReady: resendReady(emailConfiguration()) };
}
