import { emailEscape, resendReady, sendResendEmail } from './resend-email.mjs';

/** Claims are leased in PostgreSQL; only provider-accepted messages are marked sent. */
export async function deliverQueuedNotifications({ rpc, config, appUrl, fetchEmail = fetch,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now, budgetMs = 40000, allowLocalhost = false }) {
  if (!resendReady(config)) return { emailed: 0, emailFailures: 0, deferred: 0, emailStatus: config.enabled ? 'unconfigured' : 'disabled' };
  const origin = new URL(appUrl);
  const local = allowLocalhost && origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname);
  if (origin.protocol !== 'https:' && !local) throw new Error('El envío automático necesita una dirección pública HTTPS.');
  const link = new URL('/app/dashboard/billing', origin).href;
  const notices = await rpc('menupro_claim_notifications');
  const started = now();
  let emailed = 0; let emailFailures = 0; let deferred = 0;
  for (let index = 0; index < notices.length; index++) {
    const notice = notices[index];
    if (now() - started >= budgetMs) { deferred = notices.length - index; break; }
    const result = await sendResendEmail({ to: notice.email, subject: notice.subject,
      idempotencyKey: `menupro-notification/${notice.id}`,
      html: `<div lang="es" style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:auto;padding:32px"><h1 style="font-size:24px">${emailEscape(notice.subject)}</h1><p>${emailEscape(notice.message)}</p><p><a href="${emailEscape(link)}">Revisar mi cuenta en MenuPro</a></p><p>Este aviso corresponde a tu demo o suscripción de MenuPro.</p></div>`,
      text: `${notice.subject}\n\n${notice.message}\n\nRevisa tu cuenta: ${link}`,
    }, config, fetchEmail);
    // If this acknowledgement fails, keep the lease. The next run reuses the same
    // Resend idempotency key instead of claiming that the accepted message failed.
    await rpc('menupro_complete_notification', { p_notification_id: notice.id, p_token: notice.token, p_sent: result.emailSent });
    if (result.emailSent) emailed++; else emailFailures++;
    if (result.httpStatus === 429 || result.httpStatus === 401 || result.httpStatus === 403) {
      deferred = notices.length - index - 1; break;
    }
    // Resend's default sending limit is two requests/second; leave room for invites.
    if (index < notices.length - 1) await pause(650);
  }
  return { emailed, emailFailures, deferred, emailStatus: emailFailures ? 'failed' : 'processed' };
}
