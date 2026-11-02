'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui';
const date = value => value ? new Date(value).toLocaleString('es-CL') : 'Sin registro';
export default function OperationsAdmin() {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const result = await api.get('/api/admin/operations'); setData(result.data); }, []);
  useEffect(() => { load().catch(failure => setError(failure.message)); }, [load]);
  return <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Alertas operativas</h2>
    <p className="mt-2 text-sm">Los avisos de incidentes y recuperación se envían por Resend a {data?.recipient || 'tu correo administrador'}. Un incidente abierto no genera avisos repetidos en cada comprobación.</p>
    <p className="mt-3 text-sm">Último mantenimiento: <strong>{date(data?.heartbeat?.last_finished_at)}</strong> · {data?.heartbeat?.last_ok === true ? 'Completado' : data?.heartbeat?.last_ok === false ? 'Con errores' : 'Esperando primera ejecución'}</p>
    <p className="mt-2 text-sm">Última comprobación externa: {date(data?.heartbeat?.last_external_probe_at)}</p>
    <p className="mt-2 text-sm">Envío de alertas: {data?.resendReady ? 'Configurado' : 'Pendiente de configuración'} · Confirmaciones de entrega: {data?.deliveryWebhooksReady ? 'Configuradas' : 'Pendientes de configuración'}</p>
    <Button className="mt-4" disabled={busy} onClick={async () => { setBusy(true); setError(''); setMessage(''); try { const result = await api.post('/api/admin/operations/check'); await load(); setMessage(result.data.healthy ? 'Comprobación completada: sin incidentes abiertos.' : 'Comprobación completada. Revisa los incidentes abiertos.'); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }}>Comprobar ahora</Button>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-800">{message}</p>}
    <div className="mt-4 space-y-3">{(data?.incidents ?? []).filter(incident => !incident.resolved_at).map(incident => <article key={incident.id} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><h3 className="font-semibold">{incident.summary}</h3><p className="mt-1">Desde {date(incident.opened_at)}{Number.isInteger(incident.details?.count) ? ` · ${incident.details.count} registros` : ''}</p></article>)}</div>
    {data && !data.incidents.some(incident => !incident.resolved_at) && <p className="mt-4 text-sm text-emerald-800">Sin incidentes abiertos en la última comprobación.</p>}
    <details className="mt-5 text-sm"><summary className="cursor-pointer font-semibold">Historial de alertas y recuperaciones</summary><ul className="mt-3 divide-y">{(data?.alerts ?? []).map(alert => <li key={alert.id} className="py-2">{alert.subject}<span className="mt-1 block text-xs text-slate-600">{date(alert.created_at)} · {alert.accepted_at ? 'Aceptada por Resend' : `Pendiente de envío · ${alert.attempts} intentos`}</span></li>)}</ul></details>
  </section>;
}
