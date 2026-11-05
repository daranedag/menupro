import { subscriptionDisplay } from '@/lib/subscription-display.mjs';

const date = value => value ? new Date(value).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }) : 'Por confirmar';
const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
const states = { unstarted: 'Demo sin iniciar', review: 'Solicitud en revisión', trial: 'Demo activa', active: 'Acceso pagado activo',
  past_due: 'Pago por regularizar', expired: 'Acceso vencido', cancelled: 'Cancelada', suspended: 'Suspendida' };

export default function SubscriptionSummary({ subscription, checkout, children }) {
  const view = subscriptionDisplay(subscription, checkout);
  const futureCharge = view.firstChargeAt && Date.parse(view.firstChargeAt) > Date.now();
  return <section aria-label="Tu suscripción" className="rounded-xl border border-brand bg-surface p-5">
    <h3 className="text-lg font-semibold">{view.title}{subscription && ` · ${view.planId === 'grupo' ? 'Grupo' : 'Local'}`}</h3>
    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
      <div><dt className="text-muted">Acceso actual</dt><dd>{states[subscription?.effective_status ?? subscription?.status] || 'Consultando…'}</dd></div>
      <div><dt className="text-muted">Modalidad</dt><dd>{view.cycle === 'monthly' ? 'Mensual' : view.cycle === 'annual' ? 'Anual' : view.recurring ? 'Por confirmar' : 'Sin contratar'}</dd></div>
      <div><dt className="text-muted">{view.paid ? 'Período pagado hasta' : 'Demo hasta'}</dt>
        <dd>{date(view.paid ? subscription.current_period_end : subscription?.trial_ends_at)}</dd></div>
    </dl>
    {view.awaitingFirstPayment && <div className="mt-4 rounded-lg bg-canvas p-4 text-sm">
      <p className="font-semibold">{futureCharge ? 'Primer cobro programado' : 'Primer cobro por confirmar'}{view.firstChargeAmount != null && ` · ${money(view.firstChargeAmount)}`}</p>
      <p className="mt-1">Fecha prevista: {date(view.firstChargeAt)}.</p>
      <p className="mt-2">Mercado Pago confirmó la autorización de la suscripción. El primer cobro aún no está confirmado.</p>
      {subscription?.effective_status === 'trial' || subscription?.status === 'trial' ? <p className="mt-1">La demo continúa hasta su vencimiento. El período pagado se activa cuando Mercado Pago aprueba el cobro.</p> :
        <p className="mt-1">El período pagado se activa cuando Mercado Pago aprueba el cobro.</p>}
    </div>}
    {subscription?.cancel_at_period_end && <p className="mt-3 text-sm">La renovación automática está desactivada.</p>}
    {view.recurring && !view.authorized && <p className="mt-3 text-sm">Falta completar la autorización en Mercado Pago.</p>}
    {children}
  </section>;
}
