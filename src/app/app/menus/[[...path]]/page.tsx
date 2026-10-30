import { redirect } from 'next/navigation';
export default async function LegacyMenus({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  redirect('/app/dashboard/menus' + (path.length ? '/' + path.map(p => p === 'nueva' ? 'new' : p).join('/') : ''));
}
