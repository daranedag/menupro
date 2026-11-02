import Link from 'next/link';
import { Check } from 'lucide-react';
import MarketingLayout from '@/components/MarketingLayout';
import { commercialSettings } from '@/server/commercial';
export const metadata = { title: 'Planes y precios' };
export const dynamic = 'force-dynamic';
const plans = [{ name: 'Local', locations: '1 restaurante', monthly: '$9.990', annual: '$99.900' },
  { name: 'Grupo', locations: 'Hasta 3 restaurantes', monthly: '$24.990', annual: '$249.900' }];
export default async function Prices() {
  const availability = await commercialSettings();
  return <MarketingLayout><section className="page-intro mx-auto max-w-5xl px-6 pb-16"><p className="text-sm font-semibold text-[var(--color-accent)]">Precios en pesos chilenos</p>
    <h1 className="mt-3 text-4xl font-semibold">Un lugar para cada carta.</h1><p className="mt-5 max-w-2xl text-lg text-muted">Prueba MenuPro durante 15 días sin tarjeta. Si continúas, conservas tus cartas, direcciones y QR.</p>
    <div className="mt-10 grid gap-6 md:grid-cols-2">{plans.map(plan => <article key={plan.name} className="price-plan"><h2 className="text-2xl font-semibold">{plan.name}</h2>{plan.name === 'Grupo' && !availability.grupo_enabled && <p className="mt-2 font-semibold text-amber-600">Próximamente · en desarrollo</p>}<p className="mt-2 text-muted">{plan.locations}</p>
      <p className="price-amount mt-7 text-5xl font-semibold">{plan.monthly}<span className="ml-1 text-sm font-normal text-muted"> brutos / mes</span></p><p className="mt-1 text-sm text-muted">Boleta de honorarios, sin IVA.</p>
      <p className="mt-5 font-semibold">{availability.annual_enabled ? `Anual: ${plan.annual} brutos` : 'Modalidad anual · próximamente'}</p>{availability.annual_enabled && <p className="mt-1 text-sm text-muted">Un cobro por 12 meses; equivale a pagar 10 mensualidades.</p>}
      <ul className="my-6 space-y-2 text-sm"><li><Check size={16} aria-hidden="true" />Cartas y platos ilimitados</li><li><Check size={16} aria-hidden="true" />Publicación y códigos QR</li><li><Check size={16} aria-hidden="true" />Personalización y exportación PDF</li><li><Check size={16} aria-hidden="true" />Sin cobros por escaneos ni modificaciones</li></ul>
      {(plan.name === 'Local' || availability.grupo_enabled) ? <Link href="/app/register" className="btn-primary inline-flex rounded-lg px-5 py-3 font-semibold">Probar gratis 15 días</Link> : <p className="font-semibold text-muted">Te avisaremos cuando Grupo esté disponible.</p>}</article>)}</div>
    <div className="price-welcome mt-8 p-7"><h2 className="text-xl font-semibold">Una bienvenida para continuar con tu carta</h2><p className="mt-3 text-muted">Activa la demo y guarda tu primera carta. Al contratar hasta siete días después de su término, recibe un 20% de descuento en las primeras tres mensualidades{availability.annual_enabled ? ' o un 10% sobre tu primer pago anual.' : '.'}</p>
      <p className="mt-3 text-sm text-muted">Una demo y una bienvenida por negocio. La contratación no consume tus días gratuitos. La renovación automática requiere tu autorización y se puede cancelar antes del siguiente cobro.</p></div>
    <p className="mt-8 text-sm text-muted">Si el receptor debe retener, paga por Mercado Pago el honorario menos la retención y declara y paga la diferencia al SII. Si corresponde PPM del emisor, paga el bruto completo. El resumen de contratación detalla los importes antes de autorizar.</p>
    <p className="mt-8 text-muted">Para más de tres restaurantes, <Link href="/contacto" className="underline">conversemos</Link>.</p>
  </section></MarketingLayout>;
}
