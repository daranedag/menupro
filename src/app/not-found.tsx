import Link from 'next/link';
import Brand from '@/components/Brand';
import { BookOpen } from 'lucide-react';
export default function NotFound() {
  return <div className="marketing-site min-h-screen"><div className="content-width py-8"><Brand /></div><main className="mx-auto max-w-lg px-6 py-20 text-center"><BookOpen size={42} strokeWidth={1.3} aria-hidden="true" className="mx-auto mb-6 text-[var(--color-accent)]" /><h1 className="text-4xl font-medium">Esta página no está en la carta.</h1><p className="mt-5 leading-relaxed text-muted">Si buscabas un menú, revisa su enlace o consulta al restaurante si está publicado.</p><Link href="/" className="button-primary mt-8">Volver a MenuPro</Link></main></div>;
}
