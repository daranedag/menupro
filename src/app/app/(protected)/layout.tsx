import { redirect } from 'next/navigation';
import { getUser } from '@/server/insforge';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/app/login');
  return children;
}
