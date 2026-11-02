'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNavigate } from '@/lib/navigation';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './marketing/ThemeToggle';
import { LayoutDashboard, BookText, Settings, LogOut, Menu, X, Shield, Building2, CreditCard } from 'lucide-react';

const dashboardLinks = [
  { href: '/app/dashboard/business', label: 'Mi negocio', icon: Building2 },
  { href: '/app/dashboard/billing', label: 'Suscripción', icon: CreditCard },
  { href: '/app/dashboard/admin', label: 'Admin', icon: Shield, adminOnly: true },
  { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/dashboard/menus', label: 'Mis Cartas', icon: BookText },
  { href: '/app/dashboard/settings', label: 'Configuración', icon: Settings },
];

function Header({ isPublic = true }) {
  const { logout, user, selectRestaurant, selectBusiness } = useAuth();
  const navigate = useNavigate();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAdmin = user?.role?.toString?.().toLowerCase?.() === 'platform_admin';
  const links = dashboardLinks.filter(link => !link.adminOnly || isAdmin);
  const focusStyle = 'focus-visible:outline-2 focus-visible:outline-offset-2';

  const handleLogout = async () => {
    await logout();
    navigate('/app/login');
  };

  const renderLinks = mobile => links.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || (href !== '/app/dashboard' && pathname?.startsWith(href + '/'));
    return <Link key={href} href={href} onClick={() => setIsMenuOpen(false)} aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-lg font-medium transition-colors hover:bg-brand-soft hover:text-brand ${focusStyle} ${mobile ? 'px-4 py-3' : 'px-3 py-2 text-sm whitespace-nowrap'} ${active ? 'bg-brand-soft text-brand' : 'text-ink'}`}>
      <Icon size={mobile ? 20 : 18} aria-hidden="true" className="shrink-0" />
      <span>{label}</span>
    </Link>;
  });

  return (
    <header className="border-b border-line bg-surface text-ink shadow-sm">
      <div className="container mx-auto px-4 py-4">
        {!isPublic && user?.businesses?.length > 1 && <label className="mb-3 flex items-center gap-3 text-sm">Negocio activo
          <select aria-label="Negocio activo" value={user.businessId || ''} onChange={async event => { await selectBusiness(event.target.value); window.location.assign('/app/dashboard'); }} className="max-w-64 rounded-lg border bg-surface p-2 text-ink">
            {user.businesses.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}
          </select>
        </label>}
        {!isPublic && user?.restaurants?.length > 1 && <label className="mb-4 flex items-center gap-3 text-sm">Restaurante activo
          <select aria-label="Restaurante activo" value={user.activeRestaurantId || ''} onChange={event => selectRestaurant(event.target.value)} className="max-w-64 rounded-lg border bg-surface p-2 text-ink">
            {user.restaurants.map(restaurant => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
          </select>
        </label>}
        <div className="flex items-center justify-between gap-4">
          <Link href={isPublic ? '/' : '/app/dashboard'} className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2">
            <img src="/favicon.png" alt="" className="h-8 w-8" />
            <h1 className="text-2xl font-bold">MenuPro</h1>
          </Link>
          {!isPublic && <>
            <nav aria-label="Navegación principal" className="hidden items-center gap-1 xl:flex">
              {renderLinks(false)}
              <button onClick={handleLogout} className={`ml-2 flex items-center gap-2 whitespace-nowrap rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 ${focusStyle}`}>
                <LogOut size={18} aria-hidden="true" /><span>Cerrar Sesión</span>
              </button>
            </nav>
            <div className="flex items-center gap-2"><ThemeToggle />
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`rounded-lg p-2 hover:bg-brand-soft xl:hidden ${focusStyle}`}
              aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={isMenuOpen} aria-controls="dashboard-mobile-navigation">
              {isMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
            </div>
          </>}
        </div>
        {!isPublic && isMenuOpen && <nav id="dashboard-mobile-navigation" aria-label="Navegación móvil" className="mt-4 space-y-2 border-t border-line py-4 xl:hidden">
          {renderLinks(true)}
          <button onClick={() => { setIsMenuOpen(false); handleLogout(); }} className={`flex w-full items-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-medium text-white transition-colors hover:bg-red-700 ${focusStyle}`}>
            <LogOut size={20} aria-hidden="true" /><span>Cerrar Sesión</span>
          </button>
        </nav>}
      </div>
    </header>
  );
}

export default Header;
