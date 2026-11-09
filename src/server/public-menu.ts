import 'server-only';
import { cache } from 'react';
import { createPublicDatabase } from './database';
import { toMenu } from '@/lib/menu.mjs';

export const getPublicMenu = cache(async (restaurantSlug: string, menuSlug: string) => {
  const client = createPublicDatabase();
  const { data, error } = await client.database.rpc('menupro_public_menu', { p_restaurant_slug: restaurantSlug, p_menu_slug: menuSlug });
  if (error) throw new Error('No se pudo cargar la carta.');
  return data ? (data.unavailable ? { unavailable: true as const, restaurant: null, menu: null }
    : { unavailable: false as const, restaurant: data.restaurant, menu: toMenu(data.menu) }) : null;
});
