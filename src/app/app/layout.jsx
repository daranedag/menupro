import Providers from '@/components/Providers';

export const metadata = { robots: { index: false, follow: false } };
export default function AppLayout({ children }) { return <div className="app-site min-h-screen"><Providers>{children}</Providers></div>; }
