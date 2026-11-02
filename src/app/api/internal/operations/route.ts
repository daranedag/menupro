import { operationsAuthorized, checkOperations } from '@/server/operations';
import { workerRpc } from '@/server/billing';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const authorization = operationsAuthorized(request);
  if (!authorization) return Response.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    if (authorization === 'external') await workerRpc('menupro_record_external_probe');
    const result = await checkOperations();
    // A structured response distinguishes application incidents from an outage of
    // this endpoint, which the independent watchdog must report itself.
    return Response.json({ monitor: 'menupro-operations-v1', ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'No se pudo comprobar el mantenimiento.' }, { status: 503 });
  }
}
