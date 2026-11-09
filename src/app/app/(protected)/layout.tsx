import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getUser } from '@/server/database';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await getUser();
  if (!user) redirect('/app/login');
  return children;
}
