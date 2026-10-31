import 'server-only';
import { sendInvitationEmail } from '@/lib/invitation-email.mjs';

export function invitationEmailReady() {
  return process.env.MENUPRO_EMAIL_ENABLED === 'true'
    && Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim());
}

export async function deliverInvitation(invitation: {
  id: string; to: string; url: string; businessName: string; kind: 'team' | 'demo';
}) {
  const result = await sendInvitationEmail(invitation, {
    enabled: process.env.MENUPRO_EMAIL_ENABLED === 'true',
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM,
  });
  if (result.emailStatus === 'failed' || result.emailStatus === 'unconfigured') {
    console.error('MenuPro invitation email:', result.emailStatus);
  }
  return result;
}
