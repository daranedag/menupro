'use client';
import { useMenu } from '@/contexts/MenuContext';
import { usePathname } from 'next/navigation';

export default function MenuFormGate({ children }) {
  const { isLoading } = useMenu();
  const pathname = usePathname();
  if (isLoading && /\/menus\//.test(pathname)) return <p className="p-8 text-slate-500">Cargando carta…</p>;
  return children;
}
