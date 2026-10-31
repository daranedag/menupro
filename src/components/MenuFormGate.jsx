'use client';
import { useMenu } from '@/contexts/MenuContext';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function MenuFormGate({ children }) {
  const { isLoading } = useMenu();
  const pathname = usePathname();
  const { user } = useAuth();
  if (isLoading && /\/menus\//.test(pathname)) return <p className="p-8 text-slate-500">Cargando carta…</p>;
  if (user && !user.canEdit && /\/(new|edit)$|\/dishes\//.test(pathname)) return <div className="p-8"><p>Tu contenido está disponible para consulta. Activa tu suscripción para editar.</p><Link href="/app/dashboard/billing" className="mt-3 inline-block text-indigo-600 underline">Ver mi suscripción</Link></div>;
  return children;
}
