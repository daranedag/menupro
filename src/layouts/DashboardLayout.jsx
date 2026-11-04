'use client';
import Header from '../components/Header';
import SubscriptionBanner from '@/components/business/SubscriptionBanner';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/marketing/ThemeToggle';

function DashboardLayout({ children }) {
  const { user } = useAuth();
  const path = usePathname();
  const readOnlyMenu = path.startsWith('/app/dashboard/menus') && !user?.canEdit;
  
  return (
    <div className="dashboard-shell min-h-screen bg-canvas text-ink">
      <Header isPublic={false} />
      <div className="dashboard-body">
      <div className="dashboard-topbar"><div>{user?.isAdmin ? <p>Administración de MenuPro</p> : <><p>{user?.activeRestaurantName || user?.restaurantName || 'Tu espacio de trabajo'}</p><span>La carta de tu local, en tus manos.</span></>}</div><ThemeToggle /></div>
      {!user?.isAdmin && <SubscriptionBanner />}
      
      {/* Main Content */}
      <main className="dashboard-main">
        {readOnlyMenu ? <fieldset disabled className="contents">{children}</fieldset> : children}
      </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
