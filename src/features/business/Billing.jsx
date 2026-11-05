'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';
import BillingProfile from './BillingProfile';
import { planAvailable } from '@/lib/commercial.mjs';
import { pendingCheckouts, subscriptionDisplay } from '@/lib/subscription-display.mjs';
import SubscriptionSummary from '@/components/business/SubscriptionSummary';

const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
const date = value => value ? new Date(value).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }) : 'Sin período pagado';
const paymentStates = { approved: 'Aprobado', pending: 'Pendiente', in_process: 'En proceso', rejected: 'Rechazado', cancelled: 'Cancelado', refunded: 'Devuelto', charged_back: 'En disputa' };
export default function Billing() {
  const { user, reloadSession } = useAuth();
  const [data, setData] = useState(null);
  const [planId, setPlanId] = useState('local');
  const [cycle, setCycle] = useState('monthly');
  const [quote, setQuote] = useState(null);
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [restaurantId, setRestaurantId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const businessId = user?.businessId;
  const owner = user?.businessRole === 'owner';
  const subscription = data?.subscription ?? user?.subscription;
  const subscriptionCheckout = data?.subscriptionCheckout ?? data?.checkouts?.find(c => c.provider_id === subscription?.provider_subscription_id);
  const { recurring } = subscriptionDisplay(subscription, subscriptionCheckout);
  const upgrade = Boolean(subscription?.current_period_end && Date.parse(subscription.current_period_end) > Date.now() && subscription.plan_id === 'local' && planId === 'grupo');
  const purpose = upgrade ? 'upgrade' : 'subscription';
  const load = useCallback(async () => {
    if (!businessId) return;
    try { const response = await api.get('/api/billing'); setData(response.data); }
    catch (failure) { setError(failure.message); }
  }, [businessId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    // Quote only after the saved billing profile arrives, before consent is shown.
    if (!businessId || !owner || !data || (recurring && !showPlans)) return;
    if (!planAvailable(planId, cycle, data.availability)) { setQuote(null); setAccepted(false); return; }
    let current = true;
    setQuote(null); setAccepted(false);
    api.post('/api/billing/quote', { planId, cycle, purpose }).then(response => { if (current) setQuote(response.data); })
      .catch(failure => { if (current) setError(failure.message); });
    return () => { current = false; };
  }, [businessId, owner, planId, cycle, purpose, data, recurring, showPlans]);
  async function run(action) {
    setBusy(true); setError(''); setMessage('');
    try { const result = await action(); setMessage(result?.data?.message || 'Cambios guardados.'); await reloadSession(); await load(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <DashboardLayout><div className="mx-auto max-w-5xl space-y-6 text-ink">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold dark:text-white">Suscripción y pagos</h2><p className="mt-2 text-muted">Tu cuenta, tus restaurantes y tus QR se conservan al contratar.</p></div>
      {owner && data?.profile && <Button variant="outline" aria-expanded={showProfile} aria-controls="billing-profile" onClick={() => setShowProfile(value => !value)}>Revisar y editar datos de boleta</Button>}</div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-900">{message}</p>}
    <SubscriptionSummary subscription={subscription} checkout={subscriptionCheckout}>
      {owner && subscriptionCheckout && recurring && <button disabled={busy} className="mt-4 mr-4 text-sm text-brand underline" onClick={() => run(() => api.post('/api/billing/refresh', { requestId: subscriptionCheckout.id }))}>Actualizar estado de suscripción</button>}
      {owner && recurring && <button disabled={busy} className="mt-4 text-sm text-red-700 underline" onClick={() => {
        if (window.confirm('¿Cancelar la renovación automática? Mantendrás el acceso hasta terminar el período pagado.')) run(() => api.post('/api/billing/cancel'));
      }}>Cancelar renovación automática</button>}
      <a href="/api/business/export" className="ml-0 mt-4 block text-sm text-brand underline">Descargar mis datos</a>
    </SubscriptionSummary>
    {owner && (!data?.profile || showProfile) && <div id="billing-profile"><BillingProfile profile={data?.profile} onSaved={load} onDirty={setProfileDirty} /></div>}
    {owner && recurring && <Button variant="outline" aria-expanded={showPlans} aria-controls="billing-plans" onClick={() => setShowPlans(value => !value)}>{showPlans ? 'Ocultar planes' : 'Ver planes y gestionar cambios'}</Button>}
    {(!recurring || showPlans) && <div id="billing-plans" className="space-y-6">
    <div className="grid gap-5 sm:grid-cols-2">{(data?.plans ?? []).map(plan => <section key={plan.id} className={`rounded-xl border bg-surface p-5 ${planId === plan.id ? 'ring-2 ring-brand' : ''}`}>
      <h3 className="text-xl font-bold">{plan.name}</h3><p className="mt-2 text-2xl font-semibold">{money(cycle === 'annual' ? plan.annual_net : plan.monthly_net)} <span className="text-sm font-normal">brutos / {cycle === 'annual' ? 'año' : 'mes'}</span></p>
      <p className="mt-3 text-sm">{plan.max_restaurants === 1 ? '1 restaurante' : `Hasta ${plan.max_restaurants} restaurantes`}. Cartas y platos ilimitados, QR, personalización y PDF.</p>
      {owner && <Button className="mt-4" disabled={busy || !planAvailable(plan.id, cycle, data?.availability)} onClick={() => { setPlanId(plan.id); setError(''); }}>{plan.id === 'grupo' && !data?.availability?.grupo_enabled ? 'Grupo · próximamente' : `Elegir ${plan.name}`}</Button>}
    </section>)}</div>
    {owner ? <section className="rounded-xl border bg-surface p-5"><h3 className="text-lg font-semibold">{upgrade ? 'Mejorar mi plan' : 'Continuar con MenuPro'}</h3>
      <label className="mt-4 block text-sm font-medium">Modalidad de pago <select value={cycle} onChange={event => setCycle(event.target.value)} className="ml-2 rounded border p-2" disabled={busy}>
        <option value="monthly">Mensual</option><option value="annual" disabled={!data?.availability?.annual_enabled}>{data?.availability?.annual_enabled ? 'Anual · pagas 10 meses y usas 12' : 'Anual · próximamente'}</option></select></label>
      {quote ? <div className="mt-4 rounded-lg bg-canvas p-4 text-sm"><p>Honorario bruto: {money(quote.honorarium_gross)}</p><p>Retención del receptor: {money(quote.withholding_amount)} {quote.withholding_party === 'recipient' ? `(${Number((quote.retention_rate * 100).toFixed(2))}%)` : '(PPM a cargo del emisor)'}</p>
        <p className="mt-2 text-lg font-bold">{upgrade ? 'Diferencia por este período' : 'Primer cobro'}: {money(quote.gross_amount)}</p>
        <p className="mt-2">Inicio previsto: {date(quote.starts_at)}. {cycle === 'annual' ? 'El año se paga completo en un cobro.' : 'Se cobra cada mes.'}</p>
        {quote.welcome && <p className="mt-2 font-medium text-emerald-800">Bienvenida aplicada: {cycle === 'annual' ? '10% sobre tu primer año.' : `${quote.discount_percent ?? 20}% ${quote.discount_payments === 1 ? 'solo en tu primera mensualidad' : `en las primeras ${quote.discount_payments ?? 3} mensualidades`}.`}</p>}
        <p className="mt-2">{upgrade ? 'El vencimiento actual se conserva. ' : ''}Cobro regular posterior: {money(quote.regular_gross)} / {cycle === 'annual' ? 'año' : 'mes'}. Boleta de honorarios, sin IVA. Si el receptor retiene, el cobro se ajusta a la tasa legal del año del cobro; el honorario bruto no cambia.</p>
      </div> : <p className="mt-4 text-sm">Selecciona un plan y modalidad para consultar el total.</p>}
      {!data?.configuration?.ready && <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">La contratación online estará disponible pronto. <Link href="/contacto" className="underline">Contacta a MenuPro</Link> para recibir ayuda.</p>}
      {recurring && !upgrade ? <p className="mt-4 text-sm">Ya tienes una suscripción. Puedes cancelarla o gestionar el cambio de plan sin crear otra contratación.</p> : <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); run(async () => {
        const result = await api.post('/api/billing/checkout', { planId, cycle, purpose, payerEmail: email || user.email, acceptRenewal: accepted });
        window.location.assign(result.data.url); return result;
      }); }}>
        <Input label="Correo de tu cuenta de Mercado Pago" name="payerEmail" type="email" value={email || user?.email || ''} onChange={event => setEmail(event.target.value)} required />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={!quote || busy || profileDirty} checked={accepted} onChange={event => setAccepted(event.target.checked)} required className="mt-1" />
          <span>{upgrade ? 'Autorizo el cobro de la diferencia mostrada y la nueva tarifa en las siguientes renovaciones.' : 'Autorizo la renovación automática con los importes y la modalidad mostrados. Puedo cancelarla antes de la siguiente renovación.'}</span></label>
        {(!data?.profile || profileDirty) && <p className="text-sm text-amber-900">Guarda los datos para la boleta antes de continuar.</p>}
        <Button type="submit" disabled={busy || !quote || !accepted || !data?.profile || profileDirty || !data?.configuration?.ready}>{busy ? 'Procesando…' : 'Continuar a Mercado Pago'}</Button>
      </form>}
      {subscription?.plan_id === 'grupo' && subscription.current_period_end && <form className="mt-6 space-y-3 border-t pt-5" onSubmit={event => { event.preventDefault(); run(() => api.post('/api/billing/downgrade', { restaurantId })); }}>
        <h4 className="font-semibold">Cambiar a Local en la próxima renovación</h4><p className="text-sm">Selecciona el restaurante que seguirá activo. Los demás quedarán archivados, conservando sus contenidos.</p>
        <select aria-label="Restaurante que seguirá activo" required value={restaurantId} onChange={event => setRestaurantId(event.target.value)} className="w-full rounded border p-2">
          <option value="">Seleccionar restaurante</option>{user.restaurants.filter(r => !r.archived_at).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <Button type="submit" disabled={busy || !restaurantId}>Programar reducción</Button>
      </form>}
    </section> : <p className="rounded-xl border bg-surface p-5">El propietario del negocio administra los pagos y la suscripción.</p>}
    </div>}
    {owner && pendingCheckouts(data?.checkouts).map(checkout => <section key={checkout.id} className="rounded-xl border bg-surface p-5">
      <h3 className="font-semibold">Contratación pendiente · {money(checkout.gross_amount)}</h3><p className="mt-2 text-sm">Aún no tenemos confirmación de la autorización. Si ya la completaste en Mercado Pago, consulta su estado.</p>
      <div className="mt-3 flex flex-wrap gap-4">{checkout.checkout_url && <a href={checkout.checkout_url} className="text-sm text-brand underline">Continuar contratación</a>}
        <button disabled={busy} className="text-sm text-brand underline" onClick={() => run(() => api.post('/api/billing/refresh', { requestId: checkout.id }))}>Consultar estado</button>
        {['pending', 'ready'].includes(checkout.status) && <button disabled={busy} className="text-sm text-red-700 underline" onClick={() => run(() => api.post('/api/billing/abandon', { requestId: checkout.id }))}>Anular contratación pendiente</button>}</div>
    </section>)}
    {owner && <section className="rounded-xl border bg-surface p-5"><h3 className="text-lg font-semibold">Boletas de honorarios</h3>
      {!data?.documents?.length ? <p className="mt-3 text-sm">Las boletas aparecerán después de confirmar cada pago.</p> : <ul className="mt-3 divide-y">{data.documents.map(document => <li key={document.payment_id} className="py-3 text-sm">
        <p>{document.status === 'issued' ? `Boleta N.º ${document.folio} · ${document.issued_date}` : 'Pendiente de emisión manual'} · Bruto {money(document.honorarium_gross)} · Retención {money(document.withholding_amount)}</p>
        <p className="mt-1 text-muted">Pago: {document.payment_id}. {document.review_required ? 'Documento en revisión administrativa.' : document.email_accepted_at ? 'Boleta enviada por correo.' : 'La boleta se emite manualmente y se envía por correo al estar disponible.'}</p>
        {document.storage_key && <a className="mt-2 inline-block text-brand underline" href={'/api/billing/document/' + encodeURIComponent(document.payment_id)}>Descargar boleta PDF</a>}
      </li>)}</ul>}
    </section>}
    <section className="rounded-xl border bg-surface p-5"><h3 className="text-lg font-semibold">Historial de pagos</h3>
      {!data?.payments?.length ? <p className="mt-3 text-sm text-muted">No hay pagos registrados.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Fecha</th><th className="p-2">Monto</th><th className="p-2">Estado</th><th className="p-2">Referencia</th></tr></thead>
        <tbody>{data.payments.map(payment => <tr key={payment.provider_payment_id} className="border-t"><td className="p-2">{date(payment.approved_at || payment.created_at)}</td><td className="p-2">{money(payment.amount)}</td><td className="p-2">{paymentStates[payment.status] || 'En revisión'}</td><td className="p-2"><span>{payment.provider_payment_id}</span><a className="ml-3 whitespace-nowrap text-brand underline" href={'/api/billing/receipt/' + encodeURIComponent(payment.provider_payment_id)}>Descargar registro</a></td></tr>)}</tbody></table></div>}
    </section>
  </div></DashboardLayout>;
}
