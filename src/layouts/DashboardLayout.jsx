'use client';
import Header from '../components/Header';
import SubscriptionBanner from '@/components/business/SubscriptionBanner';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

function DashboardLayout({ children }) {
  const { user } = useAuth();
  const path = usePathname();
  const readOnlyMenu = path.startsWith('/app/dashboard/menus') && !user?.canEdit;
  
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
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
