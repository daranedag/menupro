import Link from 'next/link';
export default function NotFound() {
  return <main className="mx-auto max-w-xl px-6 py-24 text-center"><h1 className="text-3xl font-bold">Página no encontrada</h1><p className="mt-4 text-slate-500">Si buscabas una carta, revisa su enlace o consulta al restaurante si está publicada.</p><Link href="/" className="mt-8 inline-block rounded-xl bg-indigo-600 px-6 py-3 text-white">Volver a MenuPro</Link></main>;
}
