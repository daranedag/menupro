'use client';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, colorPresets, fontPresets } from '@/contexts/ThemeContext';

export default function ThemeSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const restaurant = user?.restaurants?.find(restaurant => restaurant.id === user.activeRestaurantId);
  useEffect(() => {
    setTheme(restaurant?.theme || { mode: 'light', colors: colorPresets.default, colorPreset: 'default', font: fontPresets.default, fontPreset: 'default' });
  }, [restaurant?.id, restaurant?.theme, setTheme]);
  return null;
}
