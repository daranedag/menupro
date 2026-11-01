import { createHash, timingSafeEqual } from 'node:crypto';
import { checkedPaymentReadiness, paymentReadiness, runPaymentRecovery } from '@/server/billing';

export const runtime = 'nodejs';
export const maxDuration = 60;
function authorized(request: Request) {
  const supplied = request.headers.get('x-menupro-worker-secret');
  const expected = process.env.MENUPRO_WORKER_SECRET;
  if (!supplied || !expected || supplied.length > 512) return false;
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(supplied), hash(expected));
}
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'No autorizado.' }, { status: 401 });
  return Response.json(await checkedPaymentReadiness());
}
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'No autorizado.' }, { status: 401 });
  if (!paymentReadiness().ready) return Response.json({ checked: 0, recovered: 0, failures: 0, disabled: true });
  try {
    const result = await runPaymentRecovery();
    return Response.json(result, { status: result.failures ? 503 : 200 });
  } catch {
    console.error('MenuPro: no se pudo completar la conciliación de pagos.');
    return Response.json({ error: 'No se pudo completar la conciliación.' }, { status: 503 });
  }
}
