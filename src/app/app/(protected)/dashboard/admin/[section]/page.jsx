import { notFound } from 'next/navigation';
import Admin from '@/features/business/Admin';

export default async function Page({ params }) {
  const { section } = await params;
  if (!['alertas', 'solicitudes', 'transferencias', 'negocios', 'logs'].includes(section)) notFound();
  return <Admin key={section} section={section} />;
}
