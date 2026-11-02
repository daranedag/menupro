import { createHash } from 'node:crypto';
import { emailEscape, resendReady, sendResendEmail } from './resend-email.mjs';

/** Financial documents use immutable PDFs, leased jobs and stable Resend keys. */
export async function deliverFiscalDocuments({ rpc, config, paymentId = /** @type {string | null} */ (null), fetchEmail = fetch,
  now = Date.now, budgetMs = 25000, limit = 3, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!resendReady(config)) return { emailed: 0, emailFailures: 0, emailStatus: config.enabled ? 'unconfigured' : 'disabled' };
  const started = now(); let emailed = 0; let emailFailures = 0;
  for (let index = 0; index < limit && now() - started < budgetMs; index++) {
    const document = await rpc('menupro_claim_fiscal_delivery', { p_payment_id: paymentId });
    if (!document) break;
    const bytes = Buffer.from(document.content ?? '', 'base64');
    if (bytes.length < 6 || bytes.length > 2097152 || bytes.subarray(0, 5).toString() !== '%PDF-'
      || createHash('sha256').update(bytes).digest('hex') !== document.sha256) {
      await rpc('menupro_complete_fiscal_delivery', { p_payment_id: document.payment_id, p_token: document.token, p_email_id: null });
      emailFailures++; break;
    }
    const subject = `MenuPro · Boleta de honorarios N.º ${document.folio}`;
    const text = `Hola ${document.name},\n\nAdjuntamos tu boleta de honorarios N.º ${document.folio}, emitida el ${document.issued_date}, correspondiente a tu pago de MenuPro.\n\nGracias por usar MenuPro.`;
    const result = await sendResendEmail({ to: document.email, subject, text,
      html: `<div lang="es" style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:auto;padding:32px"><h1>Tu boleta de MenuPro</h1><p>Hola ${emailEscape(document.name)},</p><p>Adjuntamos la boleta de honorarios N.º <strong>${emailEscape(document.folio)}</strong>, emitida el ${emailEscape(document.issued_date)}, correspondiente a tu pago de MenuPro.</p><p>Gracias por usar MenuPro.</p></div>`,
      idempotencyKey: `menupro-fiscal/${document.tag_id}/${document.sha256}`,
      tags: [{ name: 'menupro_document', value: document.tag_id }],
      attachments: [{ filename: `MenuPro-boleta-${document.folio}.pdf`, content: bytes.toString('base64'), content_type: 'application/pdf' }],
    }, config, fetchEmail);
    // An acknowledgement error keeps the lease: retry with exactly the same PDF
    // and key. Never turn an accepted-but-unacknowledged send into a new send.
    await rpc('menupro_complete_fiscal_delivery', { p_payment_id: document.payment_id, p_token: document.token, p_email_id: result.emailId ?? null });
    if (result.emailSent) emailed++; else emailFailures++;
    if (paymentId || !result.emailSent) break;
    if (index + 1 < limit) await pause(650);
  }
  return { emailed, emailFailures, emailStatus: emailFailures ? 'failed' : 'processed' };
}
