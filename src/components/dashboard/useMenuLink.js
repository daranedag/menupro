'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMenu } from '@/contexts/MenuContext';
import { menuPath } from '@/lib/menu.mjs';

export function useMenuLink(menuId) {
  const { user } = useAuth();
  const { menus } = useMenu();
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const menu = menus.find(menu => menu.id === menuId);
  const restaurant = user?.restaurants?.find(restaurant => restaurant.id === menu?.restaurantId);
  return { url: restaurant && menu ? origin + menuPath(restaurant.slug, menu.slug) : '', isPublished: !!menu?.isPublished };
}
