import { notFound } from 'next/navigation';
import { getPublicMenu } from '@/server/public-menu';
import PublicMenuView from '@/components/PublicMenuView';

type Props = { params: Promise<{ restaurantSlug: string; menuSlug: string }> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: Props) {
  const { restaurantSlug, menuSlug } = await params;
  const data = await getPublicMenu(restaurantSlug, menuSlug);
  return { title: data && !data.unavailable ? data.menu.name + ' — ' + data.restaurant.name : 'Carta no disponible',
    ...(data?.unavailable ? { robots: { index: false, follow: false } } : {}) };
}
export default async function PublicMenu({ params }: Props) {
  const { restaurantSlug, menuSlug } = await params;
  const data = await getPublicMenu(restaurantSlug, menuSlug);
  if (!data) notFound();
  if (data.unavailable) return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6"><section className="max-w-md rounded-2xl border bg-white p-8 text-center text-slate-900"><h1 className="text-2xl font-semibold">Carta no disponible temporalmente</h1><p className="mt-4 text-slate-600">Consulta directamente con el restaurante para conocer su carta actual.</p></section></main>;
  return <PublicMenuView {...data} />;
}
