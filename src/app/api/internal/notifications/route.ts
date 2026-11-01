import { createHash, timingSafeEqual } from 'node:crypto';
import { workerRpc } from '@/server/billing';
import { emailConfiguration } from '@/server/email';
import { resendReady } from '@/lib/resend-email.mjs';
import { deliverQueuedNotifications } from '@/lib/notification-email.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(request: Request) {
  const expected = process.env.MENUPRO_WORKER_SECRET;
  const supplied = request.headers.get('x-menupro-worker-secret');
  if (!expected || !supplied || supplied.length > 512) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(expected), digest(supplied));
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'No autorizado.' }, { status: 401 });
  return Response.json({ provider: 'resend', ready: resendReady(emailConfiguration()) });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'No autorizado.' }, { status: 401 });
  const config = emailConfiguration();
  if (!resendReady(config)) return Response.json({ error: 'El envío por Resend no está configurado o está deshabilitado.' }, { status: 503 });
  try {
    // Recipients and messages come exclusively from the leased database queue.
    // Request bodies are never used to send arbitrary mail.
    const result = await deliverQueuedNotifications({ rpc: workerRpc, config, appUrl: process.env.APP_URL,
      allowLocalhost: process.env.NODE_ENV === 'development' });
    return Response.json(result, { status: result.emailFailures ? 503 : 200 });
  } catch {
    console.error('MenuPro: no se pudo procesar la cola de avisos de Resend.');
    return Response.json({ error: 'No se pudo procesar la cola de avisos.' }, { status: 503 });
  }
}
