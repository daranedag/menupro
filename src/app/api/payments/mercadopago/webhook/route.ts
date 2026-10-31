import { verifyMercadoPagoSignature } from '@/lib/billing.mjs';
import { reconcileInvoice, reconcilePayment, reconcilePreapproval } from '@/server/billing';
import { fail, HttpError } from '@/server/http';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = await request.text();
    if (raw.length > 65536) throw new HttpError('Solicitud demasiado grande.', 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new HttpError('Notificación inválida.'); }
    if (!body || typeof body !== 'object') throw new HttpError('Notificación inválida.');
    const id = url.searchParams.get('data.id');
    if (!id || url.searchParams.getAll('data.id').length !== 1 || String(body.data?.id) !== id || !verifyMercadoPagoSignature({ signature: request.headers.get('x-signature'),
      requestId: request.headers.get('x-request-id'), dataId: id, secret: process.env.MERCADOPAGO_WEBHOOK_SECRET })) {
      throw new HttpError('Firma de notificación inválida.', 401);
    }
    if (body.type === 'subscription_preapproval') await reconcilePreapproval(id);
    else if (body.type === 'subscription_authorized_payment') await reconcileInvoice(id);
    else if (body.type === 'payment') await reconcilePayment(id);
    else return Response.json({ received: true, ignored: true });
    return Response.json({ received: true });
  } catch (error) { return fail(error); }
}
