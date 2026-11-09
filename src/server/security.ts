import 'server-only';
import { createHmac } from 'node:crypto';
import { createPublicDatabase } from './database';
import { check, HttpError } from './http';

export async function enforceRequestLimit(request: Request, action: string, productionLimit = 20) {
  const secret = process.env.MENUPRO_WORKER_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new HttpError('El registro está temporalmente en mantenimiento. Inténtalo más tarde.', 503);
    return;
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const key = createHmac('sha256', secret).update(ip).digest('hex');
  const { data, error } = await createPublicDatabase().database.rpc('menupro_rate_limit', {
    p_secret: secret, p_key: key, p_action: action, p_limit: process.env.NODE_ENV === 'production' ? productionLimit : 100 });
  check(error);
  if (!data) throw new HttpError('Demasiadas solicitudes. Espera un momento antes de volver a intentarlo.', 429);
}
