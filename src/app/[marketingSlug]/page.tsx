import Link from 'next/link';
import { notFound } from 'next/navigation';
import MarketingLayout from '@/components/MarketingLayout';

const cities: Record<string, string> = { santiago: 'Santiago', valdivia: 'Valdivia' };
type Props = { params: Promise<{ marketingSlug: string }> };
export function generateStaticParams() { return Object.keys(cities).map(city => ({ marketingSlug: 'menu-digital-restaurantes-' + city })); }
export async function generateMetadata({ params }: Props) {
  const { marketingSlug } = await params;
  const city = marketingSlug.replace(/^menu-digital-restaurantes-/, '');
  return { title: 'Menú digital para restaurantes en ' + (cities[city] || 'Chile') };
}
export default async function City({ params }: Props) {
  const { marketingSlug } = await params;
  const city = marketingSlug.replace(/^menu-digital-restaurantes-/, '');
  if (!cities[city]) notFound();
  return <MarketingLayout><section className="page-intro content-width !pb-20"><p className="text-sm font-semibold text-[var(--color-accent)]">MenuPro en {cities[city]}</p><h1 className="mt-4 text-4xl font-bold">Carta digital para restaurantes en {cities[city]}</h1><p className="mt-6 text-lg leading-relaxed text-muted">Mantén tu carta al día y compártela con tus clientes desde un código QR. Administra platos, secciones y precios en un solo panel.</p><Link href="/app/login?register=true" className="mt-8 inline-block rounded-xl btn-primary px-6 py-4 font-semibold text-white">Comenzar a usar MenuPro</Link></section></MarketingLayout>;
}
