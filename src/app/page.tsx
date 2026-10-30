import Link from 'next/link';
import { QrCode, PencilLine, Smartphone, Check, ArrowRight, UtensilsCrossed, Share2 } from 'lucide-react';
import MarketingLayout from '@/components/MarketingLayout';

const features = [
  { icon: PencilLine, title: 'Actualiza tu carta en minutos', text: 'Cambia platos, descripciones y precios desde tu panel. Tus clientes ven la versión publicada.' },
  { icon: QrCode, title: 'Un QR para compartir', text: 'Descarga el código QR de tu carta y colócalo en tus mesas. Su dirección se mantiene cuando editas el contenido.' },
  { icon: Smartphone, title: 'Pensado para el celular', text: 'Tus clientes abren la carta desde su navegador, sin instalar una aplicación ni crear una cuenta.' },
  { icon: UtensilsCrossed, title: 'Todo en su sección', text: 'Organiza entradas, platos de fondo, postres y bebidas. Ordena tu carta como prefieras.' },
  { icon: Share2, title: 'Comparte tu enlace', text: 'Usa la dirección de tu carta en redes sociales, WhatsApp o la página de tu restaurante.' },
  { icon: Check, title: 'Tú decides cuándo publicar', text: 'Prepara tu carta en privado y publícala cuando esté lista para tus clientes.' },
];

export default function Home() {
  return <MarketingLayout>
    <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 to-white">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-16 sm:py-24 lg:grid-cols-2">
        <div className="max-w-xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-indigo-700"><QrCode size={15} /> CARTAS DIGITALES PARA RESTAURANTES</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-6xl">Tu carta digital,<br /><span className="text-indigo-600">siempre actualizada.</span></h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">Crea, edita y comparte el menú de tu restaurante en minutos. Sin reimprimir, sin depender de terceros.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/app/login?register=true" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-4 font-semibold text-white hover:bg-indigo-700">Comenzar a usar <ArrowRight size={18} /></Link>
            <a href="#como-funciona" className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-center font-semibold text-slate-700 hover:bg-slate-50">Ver cómo funciona</a>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Check size={16} className="text-emerald-600" /> Edita desde el panel. Comparte con un QR.</p>
        </div>
        <div className="relative flex items-center justify-center rounded-[3rem] bg-indigo-100/60 px-8 py-12">
          <div className="absolute -left-2 top-14 rounded-2xl border border-white bg-white px-5 py-4 shadow-lg sm:left-6"><span className="flex items-center gap-3 text-sm font-semibold text-slate-700"><Check className="text-emerald-500" size={20} /> Carta actualizada</span></div>
          <img src="/images/hero/menu-mockup.png" alt="Carta digital de MenuPro en un celular" width="340" height="650" className="h-auto w-64 rounded-3xl shadow-2xl sm:w-72" fetchPriority="high" />
          <div className="absolute bottom-12 right-2 rounded-2xl bg-white p-4 shadow-lg sm:right-6"><QrCode size={48} className="text-indigo-600" /><p className="mt-2 text-xs font-medium text-slate-500">Escanea y descubre</p></div>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-6 py-16 sm:py-24" id="features">
      <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Simple de gestionar</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Menos impresiones.<br />Más tiempo para tu restaurante.</h2><p className="mt-5 text-slate-600">Una carta clara para tus clientes y un panel práctico para ti.</p></div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-slate-100 bg-white p-7"><div className="mb-5 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600"><Icon size={24} /></div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p></article>)}</div>
    </section>
    <section id="como-funciona" className="bg-slate-50 px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl"><h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Tu carta lista en tres pasos</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">{[['Crea tu restaurante', 'Regístrate y agrega los datos de tu local.'], ['Prepara tu carta', 'Crea secciones, agrega tus platos y actualiza los precios.'], ['Publica y comparte', 'Publica tu carta y descarga su QR para tus mesas.']].map(([title, text], index) => <li key={title}><span className="mb-5 inline-flex size-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">{index + 1}</span><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 leading-relaxed text-slate-600">{text}</p></li>)}</ol>
      </div>
    </section>
    <section className="px-6 py-16 sm:py-24"><div className="mx-auto max-w-6xl rounded-3xl bg-slate-950 px-6 py-14 text-center text-white sm:px-16"><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Dale a tu carta una nueva forma de llegar.</h2><p className="mx-auto mt-5 max-w-xl text-slate-300">Empieza con lo esencial: tus platos, tus precios y un enlace para compartirlos.</p><Link href="/app/login?register=true" className="mt-8 inline-block rounded-xl bg-indigo-500 px-7 py-4 font-semibold hover:bg-indigo-400">Crear mi carta digital</Link></div></section>
  </MarketingLayout>;
}
