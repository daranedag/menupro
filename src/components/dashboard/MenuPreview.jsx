'use client';
import PublicMenuView from '../PublicMenuView';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function MenuPreview({ menu }) {
  const { menuTheme } = useTheme();
  const { user } = useAuth();
  const restaurant = { name: user?.activeRestaurantName || user?.restaurantName || 'Tu restaurante', theme: menuTheme };
  return <PublicMenuView restaurant={restaurant} menu={menu} />;
}
