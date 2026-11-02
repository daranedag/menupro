import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { BusinessClient } from './business';
import { check, HttpError, respond } from './http';
import { workerRpc } from './billing';
import { emailConfiguration } from './email';
import { deliverFiscalDocuments } from '@/lib/fiscal-email.mjs';

export async function uploadFiscalPdf(request: Request, client: BusinessClient) {
  if (Number(request.headers.get('content-length')) > 3000000) throw new HttpError('El PDF debe pesar como máximo 2 MB.', 413);
  const form = await request.formData();
  const input = z.object({ paymentId: z.string().min(1).max(250), folio: z.string().regex(/^[0-9]{1,20}$/),
    issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(Object.fromEntries(['paymentId','folio','issuedDate'].map(key => [key, form.get(key)])));
  const file = form.get('pdf');
  if (!(file instanceof File) || file.size < 6 || file.size > 2097152 || !file.name.toLowerCase().endsWith('.pdf')) throw new HttpError('Selecciona un archivo PDF de hasta 2 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new HttpError('El archivo no contiene un PDF válido.');
  const { data: document, error } = await client.database.from('menupro_fiscal_documents').select('business_id,review_required,email_queued_at').eq('payment_id', input.paymentId).maybeSingle(); check(error);
  if (!document) throw new HttpError('Boleta no encontrada.', 404);
  if (document.review_required || document.email_queued_at) throw new HttpError('La boleta está en revisión o ya tiene un envío registrado.', 409);
  const storage = client.storage.from('menupro_fiscal');
  const { data: uploaded, error: uploadError } = await storage.upload(`${document.business_id}/${randomUUID()}.pdf`, new Blob([bytes], { type: 'application/pdf' })); check(uploadError);
  if (!uploaded?.key || !uploaded?.url) throw new HttpError('No se pudo guardar el PDF privado.', 502);
  try {
    const saved = await client.database.rpc('menupro_admin_attach_honorarium', { p_payment_id: input.paymentId, p_folio: input.folio,
      p_issued_date: input.issuedDate, p_key: uploaded.key, p_url: uploaded.url, p_sha256: createHash('sha256').update(bytes).digest('hex'), p_content: bytes.toString('base64') });
    check(saved.error); return respond(saved.data);
  } catch (failure) {
    // Storage RLS permits removal only if the new file was never attached. A lost
    // successful database response therefore cannot delete a registered PDF.
    await storage.remove(uploaded.key).catch(() => undefined);
    throw failure;
  }
}

export async function sendFiscalPdf(client: BusinessClient, paymentId: string) {
  const queued = await client.database.rpc('menupro_admin_queue_honorarium', { p_payment_id: paymentId }); check(queued.error);
  const delivery = await deliverFiscalDocuments({ rpc: workerRpc, config: emailConfiguration(), paymentId, limit: 1 });
  return respond({ ...delivery, message: delivery.emailed ? 'Boleta aceptada por Resend para su envío.' : queued.data?.email_accepted_at ? 'Esta boleta ya tiene un envío registrado.' : 'Boleta guardada en la cola de envío. Se reintentará automáticamente.' });
}

export async function downloadFiscalPdf(client: BusinessClient, paymentId: string, businessId?: string) {
  let query = client.database.from('menupro_fiscal_documents').select('storage_key,pdf_sha256,folio').eq('payment_id', paymentId);
  if (businessId) query = query.eq('business_id', businessId);
  const { data: document, error } = await query.maybeSingle(); check(error);
  if (!document?.storage_key) throw new HttpError('PDF no encontrado.', 404);
  const result = await client.storage.from('menupro_fiscal').download(document.storage_key); check(result.error);
  if (!result.data) throw new HttpError('No se pudo recuperar el PDF.', 502);
  const bytes = Buffer.from(await result.data.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== document.pdf_sha256) throw new HttpError('El documento necesita revisión administrativa.', 409);
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="MenuPro-boleta-${document.folio}.pdf"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
