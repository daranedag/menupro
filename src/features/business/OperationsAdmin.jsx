'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui';
import { AdminFields, adminDate as date } from './AdminRecords';
export default function OperationsAdmin() {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const load = useCallback(async () => { const result = await api.get('/api/admin/operations', { params: { offset } }); setData(result.data); }, [offset]);
  useEffect(() => { load().catch(failure => setError(failure.message)); }, [load]);
  return <section className="rounded-xl border bg-surface p-5"><h2 className="text-xl font-semibold">Alertas operativas</h2>
    <p className="mt-2 text-sm">El resumen se envía una vez al día a las 17:00, hora de Santiago, a {data?.recipient || 'tu correo administrador'}.</p>
    <p className="mt-3 text-sm">Último mantenimiento: <strong>{date(data?.heartbeat?.last_finished_at)}</strong> · {data?.heartbeat?.last_ok === true ? 'Completado' : data?.heartbeat?.last_ok === false ? 'Con errores' : 'Esperando primera ejecución'}</p>
    <p className="mt-2 text-sm">Última comprobación externa: {date(data?.heartbeat?.last_external_probe_at)}</p>
    <p className="mt-2 text-sm">Envío del resumen: {data?.resendReady ? 'Configurado' : 'Pendiente de configuración'}</p>
    <Button className="mt-4" disabled={busy} onClick={async () => { setBusy(true); setError(''); setMessage(''); try { const result = await api.post('/api/admin/operations/check'); await load(); setMessage(result.data.healthy ? 'Comprobación completada: sin incidentes abiertos.' : 'Comprobación completada. Revisa los incidentes abiertos.'); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }}>Comprobar ahora</Button>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-800">{message}</p>}
    <div className="mt-4 space-y-3">{(data?.incidents ?? []).map(incident => <article key={incident.id} className="rounded-lg border bg-canvas p-3 text-sm">
      <h3 className="font-semibold">{incident.summary}</h3><p className="mt-1">Desde {date(incident.opened_at)}{Number.isInteger(incident.details?.count) ? ` · ${incident.details.count} registros` : ''}</p>
    </article>)}</div>
    {data && !data.incidents.length && <p className="mt-4 text-sm">Sin incidentes abiertos en la última comprobación.</p>}
    <h3 className="mt-6 font-semibold">Historial de alertas y recuperaciones</h3>
    {data && !data.alerts.length && <p className="mt-2 text-sm text-muted">Todavía no hay cambios registrados.</p>}
    <div className="mt-3 divide-y">{(data?.alerts ?? []).map(alert => <details key={alert.id} className="py-3 text-sm">
      <summary className="cursor-pointer rounded p-1">
        <strong>{alert.transition === 'resolved' ? 'Recuperación' : 'Alerta'}</strong>
        <span className="ml-2">{alert.incident?.summary || alert.subject}</span>
        <span className="ml-2 text-xs text-muted">{date(alert.created_at)}</span>
      </summary>
      <div className="mt-2 space-y-3 rounded bg-canvas p-3">
        <p>{alert.message}</p>
        <AdminFields values={{ código: alert.incident?.code, apertura: alert.incident?.opened_at, última_detección: alert.incident?.last_seen_at,
          recuperación: alert.incident?.resolved_at, resumen_del_día: alert.digest_date, aceptado_por_resend: alert.accepted_at,
          ...(alert.details_snapshot ?? alert.incident?.details) }} />
      </div>
    </details>)}</div>
    {(offset > 0 || data?.hasMore) && <div className="mt-3 flex items-center gap-3">
      <Button disabled={!offset || busy} onClick={() => setOffset(value => value - 50)}>Anterior</Button>
      <span className="text-sm text-muted">Página {offset / 50 + 1}</span>
      <Button disabled={!data?.hasMore || busy} onClick={() => setOffset(value => value + 50)}>Siguiente</Button>
    </div>}
    <details className="mt-5 border-t pt-4 text-sm"><summary className="cursor-pointer font-semibold">Últimos resúmenes diarios</summary>
      {data && !data.digests?.length && <p className="mt-2 text-muted">Todavía no se ha generado un resumen.</p>}
      <ul className="mt-2 divide-y">{(data?.digests ?? []).map(digest => <li key={digest.report_date} className="py-2">
        {digest.report_date} · {digest.accepted_at ? 'Aceptado por Resend el ' + date(digest.accepted_at) : `Pendiente de envío · ${digest.attempts} intentos`}
      </li>)}</ul>
    </details>
  </section>;
}
