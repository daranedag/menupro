'use client';
import PublicMenuView from '../PublicMenuView';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function MenuPreview({ menu }) {
  const { menuTheme } = useTheme();
  const { user } = useAuth();
  const visibleMenu = { ...menu, sections: (menu.sections || []).filter(section => section.isActive !== false).map(section => ({ ...section, items: (section.items || []).filter(item => item.isActive !== false) })) };
  const restaurant = { name: user?.activeRestaurantName || user?.restaurantName || 'Tu restaurante', theme: menuTheme };
  return <PublicMenuView restaurant={restaurant} menu={visibleMenu} />;
}
