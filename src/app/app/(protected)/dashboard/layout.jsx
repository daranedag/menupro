'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminHome } from '@/lib/admin-navigation';

export default function DashboardAccess({ children }) {
  const { user, isLoading } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const adminPage = path === adminHome || path.startsWith(adminHome + '/');
  const redirectToAdmin = user?.isAdmin && !adminPage;
  useEffect(() => {
    if (redirectToAdmin) router.replace(adminHome);
  }, [redirectToAdmin, router]);

  if (isLoading || redirectToAdmin) return <p role="status" className="p-6 text-sm">Cargando panel…</p>;
  return children;
}
