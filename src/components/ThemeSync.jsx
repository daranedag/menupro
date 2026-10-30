'use client';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const restaurant = user?.restaurants?.find(restaurant => restaurant.id === user.activeRestaurantId);
  useEffect(() => { if (restaurant?.theme) setTheme(restaurant.theme); }, [restaurant?.id, restaurant?.theme, setTheme]);
  return null;
}
