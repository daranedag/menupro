import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import MarketingLayout from '@/components/MarketingLayout';

const problems = [
  ['💸', 'Cambiar precios es caro', 'Cada ajuste implica reimprimir cartas o rehacer archivos.'],
  ['📄', 'Cartas desordenadas', 'Diseños poco claros dificultan la lectura y confunden al cliente.'],
  ['📱', 'QR poco optimizados', 'Menús que no se adaptan bien al celular o requieren zoom.'],
  ['⏱️', 'Dependencia de terceros', 'Cambios simples requieren tiempo, dinero y coordinación externa.'],
  ['⌛', 'Tiempo de carga', 'Menús lentos que frustran a los clientes y afectan la experiencia.'],
];
const features = [
  ['📱', 'Optimizado para celulares', 'Tu menú se ve perfecto en cualquier teléfono, sin zoom ni desorden.'],
  ['✏️', 'Editor simple', 'Agrega platos, edita precios y descripciones sin conocimientos técnicos.'],
  ['🔗', 'QR automático', 'Un código QR único para tu restaurante, listo para imprimir o compartir.'],
  ['🖨️', 'PDF imprimible', 'Genera una versión lista para imprimir cuando lo necesites.'],
  ['🌎', 'Multi idioma', 'Muestra tu carta en distintos idiomas para turistas y clientes extranjeros.'],
  ['📸', 'Fotos y descripciones', 'Presenta tus platos de forma clara y atractiva, sin saturar.'],
];
const steps = [
  ['Cargas tu menú', 'Agrega categorías, platos, precios y descripciones desde un editor simple.'],
  ['Generas tu QR', 'MenuPro crea automáticamente un QR único para tu restaurante.'],
  ['Actualizas cuando quieras', 'Cambia precios o platos en segundos, sin reimprimir ni rehacer nada.'],
];
const benefits = [
  ['⏱️', 'Ahorra tiempo', 'Cambia precios, platos o descripciones en minutos, sin depender de nadie.'],
  ['💸', 'Reduce costos', 'Elimina reimpresiones constantes y errores en cartas físicas.'],
  ['✨', 'Mejora tu imagen', 'Una carta moderna, clara y alineada con la identidad de tu local.'],
  ['✅', 'Menos errores', 'Evita confusiones entre cocina, garzones y clientes.'],
  ['🫂', 'Clientes felices', 'Ofrece una experiencia ágil y profesional que tus clientes valoran.'],
];

function Cards({ items, columns }: { items: string[][]; columns: 'three' | 'five' }) {
  return <div className={`grid gap-6 sm:grid-cols-2 ${columns === 'five' ? 'lg:grid-cols-5' : 'lg:grid-cols-3'}`}>
    {items.map(([icon, title, text]) => <article key={title} className="marketing-card rounded-2xl border border-default bg-[var(--color-bg)] p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <span aria-hidden="true" className="mb-4 inline-block text-3xl">{icon}</span>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </article>)}
  </div>;
}

export default function Home() {
  return <MarketingLayout>
    <section className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <div className="flex flex-col gap-12 md:grid md:grid-cols-2 md:items-center md:gap-16">
        <div>
          <h1 className="marketing-hero-title mb-5 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Tu carta digital, siempre actualizada</h1>
          <p className="mb-8 max-w-xl text-base text-muted sm:text-lg">Crea, edita y comparte el menú de tu restaurante en minutos. Sin reimprimir, sin depender de terceros.</p>
          <div className="relative z-10 flex flex-col items-start gap-3">
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/app/login" className="btn-primary inline-flex min-h-12 items-center justify-center gap-3 rounded-lg px-6 py-3 text-center font-semibold shadow-sm transition">Comenzar a usar <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link href="/contacto" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-default px-6 py-3 text-center font-medium transition hover:bg-[var(--color-bg-soft)]">Solicitar demo</Link>
            </div>
            <a href="#features" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 transition hover:text-[var(--color-text)] hover:underline">Ver cómo funciona <ArrowDown size={15} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="relative isolate flex justify-center">
          <div aria-hidden="true" className="marketing-hero-glow absolute inset-0 -z-10 rounded-3xl bg-[var(--color-accent-soft)] opacity-60 blur-3xl" />
          <img src="/images/hero/menu-mockup.png" alt="Carta digital MenuPro en celular" width="1024" height="1024" className="h-auto w-[260px] rounded-3xl shadow-xl sm:w-[300px] md:w-[340px]" fetchPriority="high" />
        </div>
      </div>
    </section>

    <section className="bg-[var(--color-bg-soft)] px-6 py-10 md:py-12">
      <div className="mx-auto max-w-7xl text-center">
        <p className="mb-6 text-sm uppercase tracking-wide text-muted">Pensado para restaurantes</p>
        <h2 className="mb-10 text-2xl font-semibold tracking-tight md:text-3xl">Diseñado para locales que quieren verse profesionales</h2>
        <div className="grid grid-cols-2 items-center gap-6 md:grid-cols-4">{['Bares', 'Cafeterías', 'Foodtrucks', 'Restaurantes'].map(label => <div key={label} className="flex h-14 items-center justify-center rounded-xl border border-default bg-[var(--color-bg)]"><span className="text-sm font-medium text-muted">{label}</span></div>)}</div>
        <p className="mx-auto mt-10 max-w-xl text-sm text-muted">MenuPro está creado para negocios gastronómicos que necesitan una carta clara, editable y alineada con su identidad.</p>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <div className="mb-14 text-center">
        <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">¿Te suena familiar?</h2>
        <p className="mx-auto max-w-2xl text-muted">La mayoría de los restaurantes enfrenta estos problemas todos los días.</p>
      </div>
      <Cards items={problems} columns="five" />
    </section>

    <section id="features" className="mx-auto max-w-7xl scroll-mt-6 px-6 py-12 md:py-16">
      <div className="mb-14 text-center">
        <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">Todo lo que tu carta necesita</h2>
        <p className="mx-auto max-w-2xl text-muted">MenuPro está pensado para el día a día real de un restaurante. Simple, ordenado y fácil de mantener.</p>
      </div>
      <Cards items={features} columns="three" />
    </section>

    <section id="demo" className="bg-[var(--color-bg-soft)] px-6 py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">Solicita una demo</h2>
          <p className="text-muted">Déjanos tus datos y te contactamos para mostrarte MenuPro en acción.</p>
        </div>
        <form method="POST" action="https://formspree.io/f/mwvejzrb" className="space-y-6 rounded-2xl border border-default bg-[var(--color-bg)] p-6 md:p-8">
          <div><label htmlFor="demo-name" className="mb-1 block text-sm font-medium">Nombre</label><input id="demo-name" name="name" type="text" autoComplete="name" required className="w-full rounded-lg border border-default bg-transparent px-4 py-3" /></div>
          <div><label htmlFor="demo-restaurant" className="mb-1 block text-sm font-medium">Restaurante</label><input id="demo-restaurant" name="restaurant" type="text" autoComplete="organization" required className="w-full rounded-lg border border-default bg-transparent px-4 py-3" /></div>
          <div><label htmlFor="demo-email" className="mb-1 block text-sm font-medium">Email</label><input id="demo-email" name="email" type="email" autoComplete="email" required className="w-full rounded-lg border border-default bg-transparent px-4 py-3" /></div>
          <div><label htmlFor="demo-whatsapp" className="mb-1 block text-sm font-medium">WhatsApp <span className="text-xs text-muted">(opcional)</span></label><input id="demo-whatsapp" name="whatsapp" type="tel" autoComplete="tel" placeholder="+56 9 1234 5678" className="w-full rounded-lg border border-default bg-transparent px-4 py-3" /></div>
          <div><label htmlFor="demo-message" className="mb-1 block text-sm font-medium">Mensaje (opcional)</label><textarea id="demo-message" name="message" rows={4} placeholder="Cuéntanos qué tipo de restaurante tienes" className="w-full rounded-lg border border-default bg-transparent px-4 py-3" /></div>
          <button type="submit" className="btn-primary w-full rounded-lg py-3 font-medium transition">Solicitar demo</button>
          <p className="text-center text-xs text-muted">Te contactaremos dentro de las próximas 24 horas.</p>
        </form>
      </div>
    </section>

    <section id="como-funciona" className="px-6 py-12 md:py-16">
      <div className="mb-14 text-center">
        <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">Así de simple</h2>
        <p className="mx-auto max-w-2xl text-muted">MenuPro está diseñado para que puedas empezar sin complicaciones.</p>
      </div>
      <ol className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 md:grid-cols-3">{steps.map(([title, text], index) => <li key={title} className="rounded-[1.25rem] border border-default bg-[var(--color-bg)] px-6 py-8 text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent)]">{index + 1}</span>
        <h3 className="mb-2 font-semibold">{title}</h3><p className="text-sm leading-relaxed text-muted">{text}</p>
      </li>)}</ol>
    </section>

    <section className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <h2 className="mb-14 text-center text-3xl font-semibold tracking-tight md:text-4xl">Beneficios que impactan tu operación diaria</h2>
      <Cards items={benefits} columns="five" />
    </section>

    <section className="bg-[var(--marketing-button)] px-6 py-12 text-white md:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-6 text-3xl font-semibold tracking-tight md:text-4xl">Lleva tu carta al siguiente nivel</h2>
        <p className="mb-10 text-lg text-white/90">Te ayudamos a crear una carta digital clara, editable y lista para tus clientes.</p>
        <a href="https://wa.me/56967603803" className="inline-block rounded-xl bg-white px-8 py-4 font-medium text-[var(--marketing-button)] transition hover:bg-white/90">Hablar por WhatsApp</a>
      </div>
    </section>
  </MarketingLayout>;
}
