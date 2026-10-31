'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useNavigate } from '@/lib/navigation';

import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LayoutDashboard, BookText, Settings, Sun, Moon, LogOut, Menu, X, Shield } from 'lucide-react';

function Header({ isPublic = true }) {
  const { t } = useTranslation();
  const { logout, user, selectRestaurant, selectBusiness } = useAuth();
  const { theme, toggleMode } = useTheme();
  const isDark = theme.mode === 'dark';
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/app/login');
  };

  const role = user?.role?.toString?.().toLowerCase?.();

  return (
    <header className={`shadow-sm border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
      <div className="container mx-auto px-4 py-4">
        {!isPublic && user?.businesses?.length > 1 && <label className="mb-3 flex items-center gap-3 text-sm text-slate-500">Negocio activo
          <select aria-label="Negocio activo" value={user.businessId || ''} onChange={async event => { await selectBusiness(event.target.value); window.location.assign('/app/dashboard'); }} className="max-w-64 rounded-lg border bg-white p-2 text-slate-900">
            {user.businesses.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}
          </select>
        </label>}
        {!isPublic && user?.restaurants?.length > 1 && <label className="mb-4 flex items-center gap-3 text-sm text-slate-500">Restaurante activo
          <select aria-label="Restaurante activo" value={user.activeRestaurantId || ''} onChange={event => selectRestaurant(event.target.value)} className="max-w-64 rounded-lg border bg-white p-2 text-slate-900">
            {user.restaurants.map(restaurant => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
          </select>
        </label>}
        <div className="flex items-center justify-between">
          <Link href={isPublic ? '/' : '/app/dashboard'} className="flex items-center space-x-2">
            <img src="/favicon.png" alt="MenuPro Logo" className="w-8 h-8" />
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>MenuPro</h1>
          </Link>
          
          {!isPublic && (
            <>
              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center space-x-4">
                <Link href="/app/dashboard/business" className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600">Mi negocio</Link>
                <Link href="/app/dashboard/billing" className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600">Suscripción</Link>
                {role === 'platform_admin' && (
                  <Link href="/app/dashboard/admin" className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                    isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                    <Shield size={18} />
                    <span>Admin</span>
                  </Link>
                )}
                <Link href="/app/dashboard" className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                  <LayoutDashboard size={18} />
                  <span>Dashboard</span>
                </Link>
                <Link href="/app/dashboard/menus" className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                  <BookText size={18} />
                  <span>Mis Cartas</span>
                </Link>
                <Link href="/app/dashboard/settings" className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                  <Settings size={18} />
                  <span>Configuración</span>
                </Link>
                
                {/* Theme Toggle Desktop */}
                <button
                  onClick={toggleMode}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {isDark ? <Moon size={18} /> : <Sun size={18} />}
                </button>

                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  <LogOut size={18} />
                  <span>Cerrar Sesión</span>
                </button>
              </nav>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`md:hidden p-2 rounded-lg ${
                  isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        {!isPublic && isMenuOpen && (
          <div className={`md:hidden mt-4 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <nav className="space-y-2">
              <Link href="/app/dashboard/business" className="block rounded-lg px-4 py-3 font-medium text-indigo-600">Mi negocio y equipo</Link>
              <Link href="/app/dashboard/billing" className="block rounded-lg px-4 py-3 font-medium text-indigo-600">Suscripción y pagos</Link>
              {role === 'platform_admin' && (
                <Link 
                  href="/app/dashboard/admin"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                    isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Shield size={20} />
                  <span>Admin</span>
                </Link>
              )}

              <Link 
                href="/app/dashboard" 
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>
              
              <Link 
                href="/app/dashboard/menus"
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <BookText size={20} />
                <span>Mis Cartas</span>
              </Link>
              
              <Link 
                href="/app/dashboard/settings"
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings size={20} />
                <span>Configuración</span>
              </Link>

              {/* Theme Toggle Mobile */}
              <button
                onClick={toggleMode}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium transition-colors ${
                  isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  {isDark ? <Moon size={20} /> : <Sun size={20} />}
                  <span>{isDark ? 'Modo Oscuro' : 'Modo Claro'}</span>
                </span>
                <span className="text-xs opacity-70">
                  {isDark ? '→ Claro' : '→ Oscuro'}
                </span>
              </button>

              {/* Logout Mobile */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                <LogOut size={20} />
                <span>Cerrar Sesión</span>
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
