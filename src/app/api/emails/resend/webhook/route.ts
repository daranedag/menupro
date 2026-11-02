import { Webhook } from 'svix';
import { z } from 'zod';
import { workerRpc } from '@/server/billing';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Notificaciones no configuradas.' }, { status: 503 });
  if (Number(request.headers.get('content-length')) > 65536) return new Response(null, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 65536) return new Response(null, { status: 413 });
  let event: any;
  const id = request.headers.get('svix-id') || '';
  try {
    new Webhook(secret).verify(raw, { 'svix-id': id, 'svix-timestamp': request.headers.get('svix-timestamp') || '', 'svix-signature': request.headers.get('svix-signature') || '' });
    event = JSON.parse(raw);
  } catch { return Response.json({ error: 'Firma inválida.' }, { status: 401 }); }
  const allowed = ['email.sent','email.delivered','email.bounced','email.complained','email.failed','email.suppressed','email.delivery_delayed'];
  if (!allowed.includes(event?.type)) return Response.json({ received: true });
  const emailId = z.string().min(1).max(200).safeParse(event.data?.email_id);
  const date = Date.parse(event.created_at);
  if (!emailId.success || !Number.isFinite(date)) return Response.json({ error: 'Evento inválido.' }, { status: 400 });
  const tags = event.data?.tags;
  const value = Array.isArray(tags) ? tags.find((tag: any) => tag.name === 'menupro_document')?.value : tags?.menupro_document;
  const tag = z.string().uuid().safeParse(value);
  const noticeValue = Array.isArray(tags) ? tags.find((item: any) => item.name === 'menupro_notification')?.value : tags?.menupro_notification;
  const noticeTag = z.string().uuid().safeParse(noticeValue);
  try {
    await workerRpc('menupro_record_email_event_v2', { p_event_id: id, p_email_id: emailId.data, p_type: event.type,
      p_occurred_at: new Date(date).toISOString(), p_document_tag: tag.success ? tag.data : null, p_notification_tag: noticeTag.success ? noticeTag.data : null });
    return Response.json({ received: true });
  } catch { return Response.json({ error: 'No se pudo registrar el evento.' }, { status: 503 }); }
}
