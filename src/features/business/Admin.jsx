'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';
import FiscalAdmin from './FiscalAdmin';
import CommercialAdmin from './CommercialAdmin';
import OperationsAdmin from './OperationsAdmin';
import { AdminRecords, BusinessDirectory, LogHistory, TransferHistory, adminDate } from './AdminRecords';

const subtitles = {
  planes: 'Controla qué planes y modalidades pueden contratar los negocios.',
  alertas: 'Revisa incidentes, recuperaciones y el envío del resumen diario.',
  solicitudes: 'Gestiona las demos y las condiciones comerciales de cada negocio.',
  transferencias: 'Registra pagos verificados y gestiona las boletas emitidas en el SII.',
  negocios: 'Consulta el estado, los locales, el equipo y los datos de cada negocio.',
  logs: 'Busca acciones y revisa quién las realizó, cuándo y sobre qué negocio.',
};

export default function Admin({ section = 'planes' }) {
  const { user } = useAuth();
  if (!user?.isAdmin) return <DashboardLayout><p>No tienes acceso a la administración de MenuPro.</p></DashboardLayout>;
  return <DashboardLayout><div className="mx-auto max-w-6xl space-y-6 text-ink">
    <div className="border-b pb-5">
      <h1 className="text-2xl font-bold">Administración de MenuPro</h1>
      <p className="mt-2 text-sm text-muted">{subtitles[section]}</p>
    </div>
    {section === 'planes' && <CommercialAdmin />}
    {section === 'alertas' && <OperationsAdmin />}
    {['solicitudes', 'transferencias'].includes(section) && <AdminForms key={section} section={section} />}
    {section === 'negocios' && <BusinessDirectory />}
    {section === 'logs' && <LogHistory />}
  </div></DashboardLayout>;
}

function BusinessOptions({ businesses }) {
  return <><option value="">Seleccionar negocio</option>{businesses.map(b =>
    <option key={b.id} value={b.id}>{b.name} · {b.owner_email || 'Invitación pendiente'}</option>)}</>;
}

function AdminForms({ section }) {
  const [businesses, setBusinesses] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [claimStatus, setClaimStatus] = useState('review');
  const [reasons, setReasons] = useState({});
  const [prepared, setPrepared] = useState({ name: '', email: '' });
  const [courtesy, setCourtesy] = useState({ businessId: '', planId: 'local', days: 15, reason: '' });
  const [offer, setOffer] = useState({ businessId: '', percent: '', reason: '' });
  const [bank, setBank] = useState({ businessId: '', planId: 'local', cycle: 'monthly', reference: '', reason: '', grossAmount: '' });
  const [claimDetails, setClaimDetails] = useState({});
  const [preparedUrl, setPreparedUrl] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setLoadError('');
    api.get('/api/admin/business-choices', options).then(({ data }) => setBusinesses(data))
      .catch(failure => { if (!controller.signal.aborted) setLoadError(failure.message); });
    if (section === 'transferencias') {
      api.get('/api/admin/commercial', options).then(({ data }) => setAvailability(data))
        .catch(failure => { if (!controller.signal.aborted) setLoadError(failure.message); });
    }
    return () => controller.abort();
  }, [section, refresh]);

  async function run(action, notice, reload = true) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await action();
      if (reload) setRefresh(value => value + 1);
      setMessage(typeof notice === 'function' ? notice(result) : notice);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    {(error || loadError) && <p role="alert" className="rounded bg-red-50 p-4 text-red-800">{error || loadError}</p>}
    {message && <p role="status" className="rounded bg-emerald-50 p-4 text-emerald-900">{message}</p>}
    {section === 'solicitudes' ? <>
      <AdminRecords kind="claims" title="Solicitudes de demo" refresh={refresh} filters={{ status: claimStatus }}
        controls={<label className="block text-sm">Estado de la solicitud<select className="ml-2 rounded border p-2" value={claimStatus}
          onChange={event => setClaimStatus(event.target.value)}><option value="review">Pendientes</option><option value="all">Todas</option>
          <option value="granted">Concedidas</option><option value="denied">Denegadas</option></select></label>}
        empty="No hay solicitudes en esta vista."
        renderRow={claim => (
        <div key={claim.id} className="space-y-3 py-4"><p className="font-semibold">{claim.name || 'Negocio sin nombre'}</p>
        <p className="text-sm text-muted">{claim.actor_email || 'Correo no disponible'} · {adminDate(claim.created_at)}</p>
        {claim.status !== 'review' ? <p className="text-sm">{claim.status === 'granted' ? 'Concedida' : 'Denegada'}{claim.reviewed_at && ' · ' + adminDate(claim.reviewed_at)}{claim.reason && ' · ' + claim.reason}</p> : <>
        <button disabled={busy} className="text-sm text-brand underline" onClick={() => run(async () => {
          const { data } = await api.post('/api/admin/claim', { claimId: claim.id }); setClaimDetails(previous => ({ ...previous, [claim.id]: data }));
        }, 'Antecedentes disponibles para revisión.', false)}>Ver datos y posibles coincidencias</button>
        {claimDetails[claim.id] && <div className="space-y-2 rounded bg-canvas p-3 text-sm"><p className="font-semibold">Solicitud</p>
          {claimDetails[claim.id].requested.map((r, index) => <p key={index}>{r.name} · {r.phone} · {r.address} {r.unit}, {r.city}</p>)}
          <p className="font-semibold">Registros relacionados</p>{claimDetails[claim.id].matches.map((match, index) => <div key={index}><p>{match.name}</p>
            {(match.restaurants ?? []).map((r, i) => <p key={i}>{r.name} · {r.phone} · {r.address} {r.unit}, {r.city}</p>)}</div>)}</div>}
        <Input label="Motivo de la decisión" name={'reason-' + claim.id} value={reasons[claim.id] || ''} onChange={event => setReasons(previous => ({ ...previous, [claim.id]: event.target.value }))} minLength={5} maxLength={1000} />
        <div className="flex gap-3"><Button disabled={busy || (reasons[claim.id] || '').trim().length < 5} onClick={() => run(() => api.post('/api/admin/review', { claimId: claim.id, approve: true, reason: reasons[claim.id] }), 'Demo aprobada por 15 días desde ahora.')}>Aprobar demo</Button>
          <Button disabled={busy || (reasons[claim.id] || '').trim().length < 5} variant="danger" onClick={() => run(() => api.post('/api/admin/review', { claimId: claim.id, approve: false, reason: reasons[claim.id] }), 'Solicitud revisada y denegada.')}>Denegar</Button></div>
        </>}
      </div>)} />
    <div className="grid gap-6 md:grid-cols-2"><form className="space-y-4 rounded-xl border bg-surface p-5" onSubmit={event => { event.preventDefault(); run(async () => {
      const { data } = await api.post('/api/admin/prepare', prepared); setPreparedUrl(data.url); return data;
    }, data => data.emailSent ? 'Negocio preparado e invitación enviada por correo. La demo todavía no ha comenzado.' : 'Negocio preparado. El correo no se envió; comparte el enlace con el destinatario. La demo todavía no ha comenzado.'); }}>
      <h3 className="text-lg font-semibold">Preparar demo asistida</h3><Input label="Nombre del negocio" name="prepareName" value={prepared.name} onChange={event => setPrepared(p => ({ ...p, name: event.target.value }))} required />
      <Input label="Correo del propietario" name="prepareEmail" type="email" value={prepared.email} onChange={event => setPrepared(p => ({ ...p, email: event.target.value }))} required />
      <Button type="submit" disabled={busy}>Preparar e invitar</Button>
      {preparedUrl && <p className="break-all text-sm">Enlace para el destinatario: <a className="text-brand underline" href={preparedUrl}>{preparedUrl}</a></p>}
    </form>
    <form className="space-y-4 rounded-xl border bg-surface p-5" onSubmit={event => { event.preventDefault(); run(() => api.post('/api/admin/courtesy', { ...courtesy, days: Number(courtesy.days) }), 'Cortesía registrada con fecha de término.'); }}>
      <h3 className="text-lg font-semibold">Conceder cortesía</h3><label className="block text-sm">Negocio<select aria-label="Negocio de la cortesía" required value={courtesy.businessId} onChange={event => setCourtesy(p => ({ ...p, businessId: event.target.value }))} className="mt-1 w-full rounded border p-2">
        <BusinessOptions businesses={businesses} /></select></label>
      <label className="block text-sm">Plan<select aria-label="Plan de cortesía" value={courtesy.planId} onChange={event => setCourtesy(p => ({ ...p, planId: event.target.value }))} className="ml-2 rounded border p-2"><option value="local">Local</option><option value="grupo">Grupo</option></select></label>
      <Input label="Días de cortesía" name="courtesyDays" type="number" min={1} max={366} value={courtesy.days} onChange={event => setCourtesy(p => ({ ...p, days: event.target.value }))} required />
      <Input label="Motivo de la cortesía" name="courtesyReason" value={courtesy.reason} onChange={event => setCourtesy(p => ({ ...p, reason: event.target.value }))} minLength={5} maxLength={1000} required />
      <Button type="submit" disabled={busy}>Conceder cortesía</Button>
    </form>
    </div>
    <form className="space-y-4 rounded-xl border bg-surface p-5" onSubmit={event => {
      event.preventDefault();
      run(() => api.post('/api/admin/first-month-offer', { ...offer, percent: Number(offer.percent) }),
        'Descuento guardado para el primer cobro mensual.');
    }}>
      <h2 className="text-lg font-semibold">Ofrecer descuento en el primer mes</h2>
      <p className="text-sm text-muted">Se aplica una sola vez al primer cobro mensual. Puedes ofrecerlo antes de que el negocio contrate o reciba su primer pago, con o sin demo o cortesía.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Negocio del descuento<select required value={offer.businessId} onChange={event => setOffer(p => ({ ...p, businessId: event.target.value }))} className="mt-1 block w-full rounded border p-2">
          <BusinessOptions businesses={businesses} />
        </select></label>
        <Input label="Descuento (%)" name="firstMonthPercent" type="number" min={1} max={95} step={1} required value={offer.percent} onChange={event => setOffer(p => ({ ...p, percent: event.target.value }))} />
      </div>
      <Input label="Motivo del descuento" name="firstMonthReason" minLength={5} maxLength={1000} required value={offer.reason} onChange={event => setOffer(p => ({ ...p, reason: event.target.value }))} />
      <Button type="submit" disabled={busy}>Guardar descuento</Button>
    </form>
    </> : <>
    <form className="space-y-4 rounded-xl border bg-surface p-5" onSubmit={event => { event.preventDefault();
      if (window.confirm('¿Confirmas que verificaste la transferencia? Esta acción registra un pago y activa el período correspondiente.')) run(async () => {
        await api.post('/api/admin/prepaid', { ...bank, grossAmount: Number(bank.grossAmount) });
        setBank(previous => ({ ...previous, reference: '', grossAmount: '', reason: '' }));
      }, 'Pago por transferencia registrado, sin renovación automática.');
    }}><h3 className="text-lg font-semibold">Registrar una transferencia verificada</h3>
      <label className="block text-sm">Negocio<select aria-label="Negocio del pago por transferencia" required value={bank.businessId} onChange={event => setBank(p => ({ ...p, businessId: event.target.value }))} className="mt-1 w-full rounded border p-2">
        <BusinessOptions businesses={businesses} /></select></label>
      <div className="flex flex-wrap gap-4"><label className="text-sm">Plan<select aria-label="Plan del pago por transferencia" value={bank.planId} onChange={event => setBank(p => ({ ...p, planId: event.target.value }))} className="ml-2 rounded border p-2"><option value="local">Local</option><option value="grupo" disabled={!availability?.grupo_enabled}>{availability?.grupo_enabled ? 'Grupo' : 'Grupo · próximamente'}</option></select></label>
        <label className="text-sm">Período<select aria-label="Período del pago por transferencia" value={bank.cycle} onChange={event => setBank(p => ({ ...p, cycle: event.target.value }))} className="ml-2 rounded border p-2"><option value="monthly">Mensual</option><option value="annual" disabled={!availability?.annual_enabled}>{availability?.annual_enabled ? 'Anual' : 'Anual · próximamente'}</option></select></label></div>
      <Input label="Referencia única del comprobante" name="bankReference" value={bank.reference} onChange={event => setBank(p => ({ ...p, reference: event.target.value }))} minLength={4} maxLength={200} required />
      <Input label="Monto efectivamente recibido en CLP, descontando la retención del receptor si corresponde" name="bankGrossAmount" type="number" min={1} step={1} value={bank.grossAmount} onChange={event => setBank(p => ({ ...p, grossAmount: event.target.value }))} required />
      <Input label="Detalle de la verificación" name="bankReason" value={bank.reason} onChange={event => setBank(p => ({ ...p, reason: event.target.value }))} minLength={5} maxLength={1000} required />
      <Button disabled={busy} type="submit">Confirmar transferencia recibida</Button>
    </form>
    <TransferHistory refresh={refresh} />
    <FiscalAdmin key={refresh} />
    </>}
  </>;
}
