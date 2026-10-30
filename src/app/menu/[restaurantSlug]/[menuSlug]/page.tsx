import { notFound } from 'next/navigation';
import { getPublicMenu } from '@/server/public-menu';
import PublicMenuView from '@/components/PublicMenuView';

type Props = { params: Promise<{ restaurantSlug: string; menuSlug: string }> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: Props) {
  const { restaurantSlug, menuSlug } = await params;
  const data = await getPublicMenu(restaurantSlug, menuSlug);
  return { title: data ? data.menu.name + ' — ' + data.restaurant.name : 'Carta no encontrada' };
}
export default async function PublicMenu({ params }: Props) {
  const { restaurantSlug, menuSlug } = await params;
  const data = await getPublicMenu(restaurantSlug, menuSlug);
  if (!data) notFound();
  return <PublicMenuView {...data} />;
}
