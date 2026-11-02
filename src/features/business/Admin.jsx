'use client';
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';
import FiscalAdmin from './FiscalAdmin';
import CommercialAdmin from './CommercialAdmin';
import OperationsAdmin from './OperationsAdmin';

export default function Admin() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState({});
  const [prepared, setPrepared] = useState({ name: '', email: '' });
  const [courtesy, setCourtesy] = useState({ businessId: '', planId: 'local', days: 15, reason: '' });
  const [bank, setBank] = useState({ businessId: '', planId: 'local', cycle: 'monthly', reference: '', reason: '', grossAmount: '' });
  const [claimDetails, setClaimDetails] = useState({});
  const [preparedUrl, setPreparedUrl] = useState('');
  const load = useCallback(async () => {
    if (!user?.isAdmin) return;
    try { const { data } = await api.get('/api/admin/overview'); setOverview(data); } catch (failure) { setError(failure.message); }
  }, [user?.isAdmin]);
  useEffect(() => { load(); }, [load]);
  async function run(action, notice) {
    setBusy(true); setError(''); setMessage('');
    try { const result = await action(); await load(); setMessage(typeof notice === 'function' ? notice(result) : notice); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  if (!user?.isAdmin) return <DashboardLayout><p>No tienes acceso a la administración de MenuPro.</p></DashboardLayout>;
  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-6 text-slate-900">
    <h2 className="text-2xl font-bold dark:text-white">Administración de MenuPro</h2>
    <CommercialAdmin onChanged={load} />
    <OperationsAdmin />
    {error && <p role="alert" className="rounded bg-red-50 p-4 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded bg-emerald-50 p-4 text-emerald-900">{message}</p>}
    <section className="rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Solicitudes de demo por revisar</h3>
      {!overview?.claims?.length && <p className="mt-3 text-sm text-slate-500">No hay solicitudes pendientes.</p>}
      {(overview?.claims ?? []).map(claim => <div key={claim.id} className="mt-4 space-y-3 rounded border p-4"><p className="font-semibold">{claim.name}</p>
        <button disabled={busy} className="text-sm text-indigo-700 underline" onClick={() => run(async () => {
          const { data } = await api.post('/api/admin/claim', { claimId: claim.id }); setClaimDetails(previous => ({ ...previous, [claim.id]: data }));
        }, 'Antecedentes disponibles para revisión.')}>Ver datos y posibles coincidencias</button>
        {claimDetails[claim.id] && <div className="space-y-2 rounded bg-slate-50 p-3 text-sm"><p className="font-semibold">Solicitud</p>
          {claimDetails[claim.id].requested.map((r, index) => <p key={index}>{r.name} · {r.phone} · {r.address} {r.unit}, {r.city}</p>)}
          <p className="font-semibold">Registros relacionados</p>{claimDetails[claim.id].matches.map((match, index) => <div key={index}><p>{match.name}</p>
            {(match.restaurants ?? []).map((r, i) => <p key={i}>{r.name} · {r.phone} · {r.address} {r.unit}, {r.city}</p>)}</div>)}</div>}
        <Input label="Motivo de la decisión" name={'reason-' + claim.id} value={reasons[claim.id] || ''} onChange={event => setReasons(previous => ({ ...previous, [claim.id]: event.target.value }))} minLength={5} maxLength={1000} forceLight />
        <div className="flex gap-3"><Button disabled={busy || (reasons[claim.id] || '').trim().length < 5} onClick={() => run(() => api.post('/api/admin/review', { claimId: claim.id, approve: true, reason: reasons[claim.id] }), 'Demo aprobada por 15 días desde ahora.')}>Aprobar demo</Button>
          <Button disabled={busy || (reasons[claim.id] || '').trim().length < 5} variant="danger" onClick={() => run(() => api.post('/api/admin/review', { claimId: claim.id, approve: false, reason: reasons[claim.id] }), 'Solicitud revisada y denegada.')}>Denegar</Button></div>
      </div>)}
    </section>
    <div className="grid gap-6 md:grid-cols-2"><form className="space-y-4 rounded-xl border bg-white p-5" onSubmit={event => { event.preventDefault(); run(async () => {
      const { data } = await api.post('/api/admin/prepare', prepared); setPreparedUrl(data.url); return data;
    }, data => data.emailSent ? 'Negocio preparado e invitación enviada por correo. La demo todavía no ha comenzado.' : 'Negocio preparado. El correo no se envió; comparte el enlace con el destinatario. La demo todavía no ha comenzado.'); }}>
      <h3 className="text-lg font-semibold">Preparar demo asistida</h3><Input label="Nombre del negocio" name="prepareName" value={prepared.name} onChange={event => setPrepared(p => ({ ...p, name: event.target.value }))} required forceLight />
      <Input label="Correo del propietario" name="prepareEmail" type="email" value={prepared.email} onChange={event => setPrepared(p => ({ ...p, email: event.target.value }))} required forceLight />
      <Button type="submit" disabled={busy}>Preparar e invitar</Button>
      {preparedUrl && <p className="break-all text-sm">Enlace para el destinatario: <a className="text-indigo-700 underline" href={preparedUrl}>{preparedUrl}</a></p>}
    </form>
    <form className="space-y-4 rounded-xl border bg-white p-5" onSubmit={event => { event.preventDefault(); run(() => api.post('/api/admin/courtesy', { ...courtesy, days: Number(courtesy.days) }), 'Cortesía registrada con fecha de término.'); }}>
      <h3 className="text-lg font-semibold">Conceder cortesía</h3><label className="block text-sm">Negocio<select aria-label="Negocio de la cortesía" required value={courtesy.businessId} onChange={event => setCourtesy(p => ({ ...p, businessId: event.target.value }))} className="mt-1 w-full rounded border p-2">
        <option value="">Seleccionar</option>{(overview?.businesses ?? []).map(b => <option key={b.id} value={b.id}>{b.name} · {b.owner_email || 'Pendiente de aceptar'}</option>)}</select></label>
      <label className="block text-sm">Plan<select aria-label="Plan de cortesía" value={courtesy.planId} onChange={event => setCourtesy(p => ({ ...p, planId: event.target.value }))} className="ml-2 rounded border p-2"><option value="local">Local</option><option value="grupo">Grupo</option></select></label>
      <Input label="Días de cortesía" name="courtesyDays" type="number" min={1} max={366} value={courtesy.days} onChange={event => setCourtesy(p => ({ ...p, days: event.target.value }))} required forceLight />
      <Input label="Motivo de la cortesía" name="courtesyReason" value={courtesy.reason} onChange={event => setCourtesy(p => ({ ...p, reason: event.target.value }))} minLength={5} maxLength={1000} required forceLight />
      <Button type="submit" disabled={busy}>Conceder cortesía</Button>
    </form></div>
    <form className="space-y-4 rounded-xl border bg-white p-5" onSubmit={event => { event.preventDefault();
      if (window.confirm('¿Confirmas que verificaste la transferencia? Esta acción registra un pago y activa el período correspondiente.')) run(() => api.post('/api/admin/prepaid', { ...bank, grossAmount: Number(bank.grossAmount) }), 'Pago por transferencia registrado, sin renovación automática.');
    }}><h3 className="text-lg font-semibold">Registrar una transferencia verificada</h3>
      <label className="block text-sm">Negocio<select aria-label="Negocio del pago por transferencia" required value={bank.businessId} onChange={event => setBank(p => ({ ...p, businessId: event.target.value }))} className="mt-1 w-full rounded border p-2">
        <option value="">Seleccionar</option>{(overview?.businesses ?? []).map(b => <option key={b.id} value={b.id}>{b.name} · {b.owner_email || 'Invitación pendiente'}</option>)}</select></label>
      <div className="flex flex-wrap gap-4"><label className="text-sm">Plan<select aria-label="Plan del pago por transferencia" value={bank.planId} onChange={event => setBank(p => ({ ...p, planId: event.target.value }))} className="ml-2 rounded border p-2"><option value="local">Local</option><option value="grupo" disabled={!overview?.availability?.grupo_enabled}>{overview?.availability?.grupo_enabled ? 'Grupo' : 'Grupo · próximamente'}</option></select></label>
        <label className="text-sm">Período<select aria-label="Período del pago por transferencia" value={bank.cycle} onChange={event => setBank(p => ({ ...p, cycle: event.target.value }))} className="ml-2 rounded border p-2"><option value="monthly">Mensual</option><option value="annual" disabled={!overview?.availability?.annual_enabled}>{overview?.availability?.annual_enabled ? 'Anual' : 'Anual · próximamente'}</option></select></label></div>
      <Input label="Referencia única del comprobante" name="bankReference" value={bank.reference} onChange={event => setBank(p => ({ ...p, reference: event.target.value }))} minLength={4} maxLength={200} required forceLight />
      <Input label="Monto efectivamente recibido en CLP, descontando la retención del receptor si corresponde" name="bankGrossAmount" type="number" min={1} step={1} value={bank.grossAmount} onChange={event => setBank(p => ({ ...p, grossAmount: event.target.value }))} required forceLight />
      <Input label="Detalle de la verificación" name="bankReason" value={bank.reason} onChange={event => setBank(p => ({ ...p, reason: event.target.value }))} minLength={5} maxLength={1000} required forceLight />
      <Button disabled={busy} type="submit">Confirmar transferencia recibida</Button>
    </form>
    <section className="rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Negocios y suscripciones</h3><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Negocio</th><th className="p-2">Propietario</th><th className="p-2">Plan</th><th className="p-2">Acceso</th></tr></thead>
      <tbody>{(overview?.businesses ?? []).map(b => <tr key={b.id} className="border-t"><td className="p-2">{b.name}</td><td className="p-2">{b.owner_email || 'Invitación pendiente'}</td><td className="p-2">{b.plan_id}</td><td className="p-2">{b.has_access ? 'Vigente' : 'Sin acceso pagado'}</td></tr>)}</tbody></table></div></section>
    <section className="rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Actividad administrativa</h3><ul className="mt-3 divide-y">{(overview?.events ?? []).map(event => <li key={event.id} className="py-3 text-sm"><p>{event.event} · {new Date(event.created_at).toLocaleString('es-CL')}</p><p className="mt-1 break-all text-slate-500">{event.details?.reason || event.details?.payment_id || ''}</p></li>)}</ul></section>
    <FiscalAdmin />
  </div></DashboardLayout>;
}
