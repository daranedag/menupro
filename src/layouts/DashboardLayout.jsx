'use client';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';
import SubscriptionBanner from '@/components/business/SubscriptionBanner';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

function DashboardLayout({ children }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const path = usePathname();
  const readOnlyMenu = path.startsWith('/app/dashboard/menus') && !user?.canEdit;
  const isDark = theme.mode === 'dark';
  
  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <Header isPublic={false} />
      <SubscriptionBanner />
      
      {/* Main Content */}
      <main className="flex-grow p-4 sm:p-6 overflow-auto">
        {readOnlyMenu ? <fieldset disabled className="contents">{children}</fieldset> : children}
      </main>
    </div>
  );
}

export default DashboardLayout;
