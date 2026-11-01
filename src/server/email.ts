import 'server-only';
import { sendInvitationEmail } from '@/lib/invitation-email.mjs';
import { resendReady } from '@/lib/resend-email.mjs';

export function emailConfiguration() {
  return { enabled: process.env.MENUPRO_EMAIL_ENABLED === 'true', apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM, replyTo: process.env.RESEND_REPLY_TO };
}

export function invitationEmailReady() {
  return resendReady(emailConfiguration());
}

export async function deliverInvitation(invitation: {
  id: string; to: string; url: string; businessName: string; kind: 'team' | 'demo';
}) {
  const result = await sendInvitationEmail(invitation, emailConfiguration());
  if (result.emailStatus === 'failed' || result.emailStatus === 'unconfigured') {
    console.error('MenuPro invitation email:', result.emailStatus);
  }
  return result;
}
