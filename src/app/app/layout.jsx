import Providers from '@/components/Providers';

export const metadata = { robots: { index: false, follow: false } };
export default function AppLayout({ children }) { return <Providers>{children}</Providers>; }
