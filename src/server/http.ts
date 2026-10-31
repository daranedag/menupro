import 'server-only';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) {
    throw new HttpError('Solicitud no permitida.', 403);
  }
}

export function respond(data: unknown, status = 200) {
  return Response.json({ success: true, data }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? 'Datos inválidos.' }, { status: 400 });
  }
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error('MenuPro request failed:', error instanceof Error ? error.message : 'Backend error');
  return Response.json({ error: 'No se pudo completar la operación. Inténtalo nuevamente.' }, { status: 500 });
}

export function check(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new HttpError('Ya existe un registro con ese nombre o dirección.', 409);
  if (error.code === '42501') throw new HttpError('No tienes permiso para realizar esta operación.', 403);
  if (error.code === 'P0001') throw new HttpError(error.message ?? 'No se pudo completar la operación.', 409);
  throw new Error(error.message ?? 'Database error');
}
