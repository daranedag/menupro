import 'server-only';
import { cache } from 'react';
import { createPublicInsForge } from './insforge';
import { toMenu } from '@/lib/menu.mjs';

export const getPublicMenu = cache(async (restaurantSlug: string, menuSlug: string) => {
  const client = createPublicInsForge();
  const { data, error } = await client.database.rpc('menupro_public_menu', { p_restaurant_slug: restaurantSlug, p_menu_slug: menuSlug });
  if (error) throw new Error('No se pudo cargar la carta.');
  return data ? { restaurant: data.restaurant, menu: toMenu(data.menu) } : null;
});
