'use client';
import { useMenu } from '@/contexts/MenuContext';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Spinner from './ui/Spinner';

export default function MenuFormGate({ children }) {
  const { isLoading } = useMenu();
  const pathname = usePathname();
  const { user } = useAuth();
  if (isLoading && /\/menus\//.test(pathname)) return <div className="flex min-h-screen items-center justify-center bg-canvas p-8"><Spinner label="Cargando carta…" /></div>;
  if (user && !user.canEdit && /\/(new|edit)$|\/dishes\//.test(pathname)) return <div className="p-8"><p>Tu contenido está disponible para consulta. Activa tu suscripción para editar.</p><Link href="/app/dashboard/billing" className="mt-3 inline-block text-brand underline">Ver mi suscripción</Link></div>;
  return children;
}
