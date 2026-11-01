import { escapeHtml } from './billing.mjs';
import { sendResendEmail } from './resend-email.mjs';

/**
 * Configuration is supplied by the server; no credentials are read in shared code.
 * @param {{ id: string, to: string, url: string, businessName: string, kind: 'team' | 'demo' }} invitation
 * @param {{ enabled: boolean, apiKey?: string, from?: string }} config
 * @param {typeof fetch} fetchEmail
 */
export async function sendInvitationEmail(invitation, config, fetchEmail = fetch) {
  const demo = invitation.kind === 'demo';
  const subject = demo ? 'Tu negocio está preparado en MenuPro' : 'Invitación a tu equipo en MenuPro';
  const description = demo
    ? `Preparamos ${invitation.businessName} para que puedas probar MenuPro durante 15 días, sin tarjeta.`
    : `Te invitaron a formar parte del equipo de ${invitation.businessName} en MenuPro.`;
  const instruction = 'Ingresa o regístrate con el correo que recibió esta invitación y verifica tu dirección para aceptarla.';
  const trialNote = demo ? 'La demo comienza cuando la actives, después de aceptar la invitación.' : '';
  try {
    const url = new URL(invitation.url);
    if (!['https:', 'http:'].includes(url.protocol)) return { emailSent: false, emailStatus: 'failed' };
    const result = await sendResendEmail({ to: invitation.to, subject,
        idempotencyKey: `menupro-invitation/${invitation.kind}/${invitation.id}`,
        html: `<div lang="es" style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:32px"><h1 style="font-size:24px">${escapeHtml(subject)}</h1><p>${escapeHtml(description)}</p><p>${instruction}</p><p style="margin:28px 0"><a href="${escapeHtml(url.href)}" style="background:#4338ca;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none;display:inline-block">Revisar invitación</a></p>${trialNote ? `<p>${trialNote}</p>` : ''}<p>Si el botón no funciona, abre este enlace:</p><p><a href="${escapeHtml(url.href)}">${escapeHtml(url.href)}</a></p></div>`,
        text: [subject, description, instruction, url.href, trialNote].filter(Boolean).join('\n\n'),
      }, config, fetchEmail);
    return { emailSent: result.emailSent, emailStatus: result.emailStatus };
  } catch {
    // Keep the invitation available even if the provider times out or is offline.
    return { emailSent: false, emailStatus: 'failed' };
  }
}
