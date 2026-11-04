'use client';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';

const chileDate = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' });
export const adminDate = value => value ? chileDate.format(new Date(value)) : 'Sin registro';
const plan = { local: 'Local', grupo: 'Grupo' };
const cycle = { monthly: 'Mensual', annual: 'Anual' };
const states = { unstarted: 'Demo sin iniciar', review: 'En revisión', trial: 'Demo', active: 'Activo',
  past_due: 'Pago pendiente', cancelled: 'Cancelado', suspended: 'Suspendido', approved: 'Aprobada' };
const fields = {
  id: 'Identificador', name: 'Nombre', email: 'Correo', owner_email: 'Correo del propietario', owner_name: 'Propietario',
  owner_verified: 'Correo verificado', owner_id: 'ID del propietario', created_by: 'Creado por', created_at: 'Fecha de registro',
  updated_at: 'Última actualización', business_id: 'ID del negocio', status: 'Estado', plan_id: 'Plan',
  trial_started_at: 'Inicio de demo', trial_ends_at: 'Fin de demo', courtesy_until: 'Cortesía hasta',
  current_period_start: 'Inicio del período pagado', current_period_end: 'Fin del período pagado',
  billing_cycle: 'Modalidad', cancel_at_period_end: 'Renovación cancelada', first_month_offer: 'Oferta para el primer mes',
  monthly_welcome_percent: 'Descuento mensual (%)', monthly_welcome_payments: 'Mensualidades con descuento',
  legal_name: 'Nombre o razón social', address: 'Dirección', commune: 'Comuna', city: 'Ciudad', phone: 'Teléfono',
  menu_count: 'Cartas registradas', no_physical_location: 'Sin local físico', archived_at: 'Archivado el',
  amount: 'Monto', refunded_amount: 'Monto devuelto', currency: 'Moneda', approved_at: 'Aprobado el',
  active: 'Activo', role: 'Rol', expires_at: 'Vence el', accepted_at: 'Aceptada el', revoked_at: 'Revocada el',
  reason: 'Motivo', payment_id: 'ID de pago', period_end: 'Fin del período', period_start: 'Inicio del período',
};

function fieldValue(key, value) {
  if (value == null || value === '') return 'Sin registro';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return <pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(value, null, 2)}</pre>;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))) return adminDate(value);
  if (key === 'status') return states[value] || value;
  if (key === 'plan_id') return plan[value] || value;
  if (key === 'billing_cycle') return cycle[value] || value;
  return value;
}

export function AdminFields({ values }) {
  return <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
    {Object.entries(values ?? {}).map(([key, value]) => <div className="min-w-0" key={key}>
      <dt className="text-xs text-muted first-letter:uppercase">{fields[key] || key.replaceAll('_', ' ')}</dt>
      <dd className="break-words">{fieldValue(key, value)}</dd>
    </div>)}
  </dl>;
}

export function AdminRecords({ kind, title, filters, controls, refresh = 0, empty, renderRow }) {
  const query = new URLSearchParams({ kind, ...filters }).toString();
  const [page, setPage] = useState({ query, offset: 0 });
  const offset = page.query === query ? page.offset : 0;
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const url = '/api/admin/records?' + query + '&offset=' + offset;
  const requestKey = url + '#' + refresh + '/' + retry;
  const visible = result?.key === requestKey ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    api.get(url, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ key: requestKey, data });
    }).catch(failure => {
      if (!controller.signal.aborted) setResult({ key: requestKey, error: failure.message });
    });
    return () => controller.abort();
  }, [url, requestKey]);

  return <section className="rounded-xl border bg-surface p-5">
    <h2 className="text-xl font-semibold">{title}</h2>
    {controls && <div className="mt-4">{controls}</div>}
    {!visible && <p role="status" className="mt-4 text-sm text-muted">Cargando registros…</p>}
    {visible?.error && <div className="mt-4 flex items-center gap-4">
      <p role="alert" className="text-sm">{visible.error}</p><Button onClick={() => setRetry(value => value + 1)}>Reintentar</Button>
    </div>}
    {visible?.data && <>
      {visible.data.rows.length ? <div className="mt-3 divide-y">{visible.data.rows.map(renderRow)}</div> :
        <p className="mt-4 text-sm text-muted">{empty}</p>}
      {(offset > 0 || visible.data.hasMore) && <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={!offset} onClick={() => setPage({ query, offset: offset - 50 })}>Anterior</Button>
        <span className="text-sm text-muted">Página {offset / 50 + 1}</span>
        <Button disabled={!visible.data.hasMore} onClick={() => setPage({ query, offset: offset + 50 })}>Siguiente</Button>
      </div>}
    </>}
  </section>;
}

function BusinessDetails({ id }) {
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/api/admin/business-details', { params: { id }, signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ data });
    }).catch(failure => {
      if (!controller.signal.aborted) setResult({ error: failure.message });
    });
    return () => controller.abort();
  }, [id, retry]);

  if (!result) return <p role="status" className="text-sm text-muted">Cargando datos del negocio…</p>;
  if (result.error) return <><p role="alert">{result.error}</p><Button onClick={() => { setResult(null); setRetry(value => value + 1); }}>Reintentar</Button></>;
  const { business, subscription, billing, restaurants, members, invitations, demo_requests, recent_payments } = result.data;
  return <>
    <AdminFields values={business} />
    {[['Suscripción y acceso', subscription], ['Datos para la boleta', billing], ['Locales', restaurants],
      ['Equipo', members], ['Invitaciones', invitations], ['Últimas solicitudes de demo', demo_requests], ['Últimos pagos', recent_payments]]
      .map(([title, value]) => {
        const entries = Array.isArray(value) ? value : value ? [value] : [];
        return <section className="space-y-3 border-t pt-4" key={title}>
          <h3 className="font-semibold">{title}{Array.isArray(value) && ' (' + value.length + ')'}</h3>
          {entries.length ? entries.map((entry, index) => <div className="rounded border bg-surface p-3" key={entry.id || entry.user_id || index}>
            <AdminFields values={entry} />
          </div>) : <p className="text-sm text-muted">Sin registros.</p>}
        </section>;
      })}
  </>;
}

function BusinessRow({ business }) {
  const [opened, setOpened] = useState(false);
  return <details className="py-4" onToggle={event => setOpened(event.currentTarget.open)}>
    <summary className="cursor-pointer rounded p-1">
      <strong>{business.name}</strong>
      <span className="ml-2 text-sm text-muted">{business.owner_email || 'Invitación pendiente'} · {plan[business.plan_id] || 'Sin plan'} · {business.has_access ? 'Acceso vigente' : states[business.status] || 'Sin acceso'}</span>
    </summary>
    {opened && <div className="mt-3 space-y-4 rounded-lg bg-canvas p-4"><BusinessDetails id={business.id} /></div>}
  </details>;
}

export function BusinessDirectory() {
  return <AdminRecords kind="businesses" title="Negocios registrados" empty="Todavía no hay negocios registrados."
    renderRow={business => <BusinessRow key={business.id} business={business} />} />;
}

const eventLabels = {
  bank_payment_confirmed: 'Transferencia confirmada', welcome_terms_changed: 'Descuento de bienvenida actualizado',
  trial_reviewed: 'Solicitud de demo revisada', payment_approved: 'Pago aprobado', payment_restored: 'Pago recuperado',
};
const blankFilters = { from: '', to: '', actor: '', event: '' };

export function LogHistory() {
  const [draft, setDraft] = useState(blankFilters);
  const [filters, setFilters] = useState(blankFilters);
  const change = event => setDraft(current => ({ ...current, [event.target.name]: event.target.value }));
  const controls = <form onSubmit={event => { event.preventDefault(); setFilters(draft); }}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input label="Desde" type="date" name="from" max={draft.to || undefined} value={draft.from} onChange={change} />
      <Input label="Hasta" type="date" name="to" min={draft.from || undefined} value={draft.to} onChange={change} />
      <Input label="Usuario" name="actor" placeholder="Nombre, correo o ID" maxLength={255} value={draft.actor} onChange={change} />
      <Input label="Acción" name="event" placeholder="Ej. payment_approved" list="admin-log-actions" maxLength={100} value={draft.event} onChange={change} />
      <datalist id="admin-log-actions">{Object.entries(eventLabels).map(([key, label]) => <option key={key} value={key} label={label} />)}</datalist>
    </div>
    <div className="mt-3 flex flex-wrap gap-3">
      <Button type="submit">Filtrar</Button>
      <Button type="button" variant="secondary" onClick={() => { setDraft(blankFilters); setFilters(blankFilters); }}>Limpiar filtros</Button>
    </div>
  </form>;
  return <AdminRecords kind="logs" title="Actividad administrativa" controls={controls} filters={filters}
    empty="No hay acciones para los filtros seleccionados." renderRow={event => <details className="py-4" key={event.id}>
      <summary className="cursor-pointer rounded p-1">
        <strong>{eventLabels[event.event] || event.event}</strong>
        <span className="ml-2 text-sm text-muted">{adminDate(event.created_at)} · {event.actor_email || event.actor_name || (event.actor_id ? 'Usuario ' + event.actor_id : 'Sistema o actor no disponible')}{event.business_name && ' · ' + event.business_name}</span>
      </summary>
      <div className="mt-3 space-y-4 rounded bg-canvas p-4">
        <AdminFields values={{ id: event.id, acción: event.event, actor_id: event.actor_id, business_id: event.business_id }} />
        <AdminFields values={event.details} />
      </div>
    </details>} />;
}

export function TransferHistory({ refresh }) {
  return <AdminRecords kind="transfers" title="Historial de transferencias" refresh={refresh}
    empty="Todavía no hay transferencias registradas." renderRow={payment => <details key={payment.id} className="py-4">
      <summary className="cursor-pointer rounded p-1"><strong>{payment.business_name}</strong>
        <span className="ml-2 text-sm text-muted">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: payment.currency }).format(payment.amount)} · {adminDate(payment.approved_at)} · {payment.reference}</span>
      </summary>
      <div className="mt-3 rounded bg-canvas p-4">
        <AdminFields values={{ referencia: payment.reference, status: payment.status, plan_id: payment.plan_id, billing_cycle: payment.cycle,
          period_start: payment.period_start, period_end: payment.period_end, registrado_por: payment.actor_email, reason: payment.reason }} />
      </div>
    </details>} />;
}
