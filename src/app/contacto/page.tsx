import MarketingLayout from '@/components/MarketingLayout';
export const metadata = { title: 'Contacto' };
export default function Contact() {
  return <MarketingLayout><section className="mx-auto max-w-3xl px-6 py-24 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Hablemos</p><h1 className="mt-4 text-4xl font-bold">Estamos para ayudarte</h1><p className="mt-6 text-lg leading-relaxed text-slate-600">Cuéntanos sobre tu restaurante y te ayudaremos a comenzar con tu carta digital.</p><a className="mt-8 inline-block rounded-xl bg-indigo-600 px-7 py-4 font-semibold text-white" href="https://wa.me/56967603803" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a></section></MarketingLayout>;
}
