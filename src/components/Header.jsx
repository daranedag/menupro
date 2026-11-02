'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNavigate } from '@/lib/navigation';
import { useAuth } from '../contexts/AuthContext';
import Brand from './Brand';
import { LayoutDashboard, BookText, Settings, LogOut, Menu, X, Shield, Building2, CreditCard } from 'lucide-react';

const dashboardLinks = [
  { href: '/app/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/app/dashboard/menus', label: 'Mis cartas', icon: BookText },
  { href: '/app/dashboard/settings', label: 'Apariencia', icon: Settings },
  { href: '/app/dashboard/business', label: 'Mi negocio', icon: Building2 },
  { href: '/app/dashboard/billing', label: 'Suscripción', icon: CreditCard },
  { href: '/app/dashboard/admin', label: 'Administración', icon: Shield, adminOnly: true },
];

export default function Header({ isPublic = true }) {
  const { logout, user, selectRestaurant, selectBusiness } = useAuth();
  const navigate = useNavigate();
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState(null);
  const menuButton = useRef(null);
  const open = openPath === pathname;
  const isAdmin = user?.role?.toString?.().toLowerCase?.() === 'platform_admin';
  const links = dashboardLinks.filter(link => !link.adminOnly || isAdmin);
  const handleLogout = async () => { await logout(); navigate('/app/login'); };
  if (isPublic) return <header className="border-b border-line bg-surface p-6"><Brand /></header>;
  return <header className="dashboard-nav" onKeyDown={event => {
    if (event.key === 'Escape' && open) { setOpenPath(null); menuButton.current?.focus(); }
  }}>
    <div className="dashboard-brand-row"><Brand href="/app/dashboard" /><button ref={menuButton} type="button" className="dashboard-mobile-button" onClick={() => setOpenPath(open ? null : pathname)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="dashboard-navigation">{open ? <X size={21} /> : <Menu size={21} />}</button></div>
    <nav id="dashboard-navigation" aria-label="Navegación principal" className={`dashboard-nav-links ${open ? 'is-open' : ''}`}>
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/app/dashboard' && pathname?.startsWith(href + '/'));
        return <Link key={href} href={href} onClick={() => setOpenPath(null)} aria-current={active ? 'page' : undefined}><Icon size={19} strokeWidth={1.7} aria-hidden="true" />{label}</Link>;
      })}
    </nav>
    <div className={`dashboard-switches ${open ? 'is-open' : ''}`}>
      {user?.businesses?.length > 1 && <label className="dashboard-switch">Negocio activo<select aria-label="Negocio activo" value={user.businessId || ''} onChange={async event => { await selectBusiness(event.target.value); window.location.assign('/app/dashboard'); }}>{user.businesses.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>}
      {user?.restaurants?.length > 1 && <label className="dashboard-switch">Restaurante activo<select aria-label="Restaurante activo" value={user.activeRestaurantId || ''} onChange={event => selectRestaurant(event.target.value)}>{user.restaurants.map(restaurant => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>}
    </div>
    <div className={`dashboard-account ${open ? 'is-open' : ''}`}><p>{user?.name || 'Mi cuenta'}</p><span>{user?.email}</span><button type="button" onClick={handleLogout} className="dashboard-signout"><LogOut size={16} aria-hidden="true" />Cerrar sesión</button></div>
  </header>;
}
