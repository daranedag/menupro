'use client';
import { useParams } from 'next/navigation';
import { useMenu } from '@/contexts/MenuContext';
import MenuPreview from '@/components/dashboard/MenuPreview';

export default function Preview() {
  const { menuId } = useParams();
  const { menus, isLoading } = useMenu();
  const menu = menus.find(menu => menu.id === menuId);
  if (isLoading) return <p className="p-6">Cargando carta…</p>;
  if (!menu) return <p className="p-6">Carta no encontrada.</p>;
  return <MenuPreview menu={menu} />;
}
