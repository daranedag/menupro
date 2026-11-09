import { workerRpc, paymentReadiness, runPaymentRecovery } from '@/server/billing';
import { operationsAuthorized, checkOperations } from '@/server/operations';
import { emailConfiguration } from '@/server/email';
import { resendReady } from '@/lib/resend-email.mjs';
import { deliverQueuedNotifications } from '@/lib/notification-email.mjs';
import { deliverFiscalDocuments } from '@/lib/fiscal-email.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  if (operationsAuthorized(request) !== 'worker') return Response.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    await workerRpc('menupro_record_heartbeat', { p_phase: 'started' });
    const lifecycle = await workerRpc('menupro_run_lifecycle');
    const expiredHistory = await workerRpc('menupro_expire_abuse_history');
    const config = emailConfiguration();
    const [notifications, payments] = await Promise.all([
      (async () => {
        if (!resendReady(config)) return { emailed: 0, emailFailures: 0 };
        const queued = await deliverQueuedNotifications({ rpc: workerRpc, config, appUrl: process.env.APP_URL, budgetMs: 18000 });
        const fiscal = await deliverFiscalDocuments({ rpc: workerRpc, config, budgetMs: 15000 });
        return { emailed: queued.emailed + fiscal.emailed, emailFailures: queued.emailFailures + fiscal.emailFailures };
      })(),
      paymentReadiness().ready ? runPaymentRecovery() : Promise.resolve({ checked: 0, recovered: 0, failures: 0 }),
    ]);
    const ok = notifications.emailFailures === 0 && payments.failures === 0;
    await workerRpc('menupro_record_heartbeat', { p_phase: 'finished', p_ok: ok,
      p_summary: { email_failures: notifications.emailFailures, payment_failures: payments.failures } });
    // The independent watchdog sends the daily digest on its existing schedule.
    await checkOperations();
    return Response.json({ ...lifecycle, expiredHistory, ...notifications, payments }, { status: ok ? 200 : 503 });
  } catch {
    await workerRpc('menupro_record_heartbeat', { p_phase: 'finished', p_ok: false }).catch(() => {});
    return Response.json({ error: 'No se pudo completar el mantenimiento de MenuPro.' }, { status: 503 });
  }
}
