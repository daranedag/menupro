'use client';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';

function DashboardLayout({ children }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  
  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <Header isPublic={false} />
      
      {/* Main Content */}
      <main className="flex-grow p-4 sm:p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;
