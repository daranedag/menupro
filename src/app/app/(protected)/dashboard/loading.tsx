import Spinner from '@/components/ui/Spinner';

export default function Loading() {
  return <div className="flex min-h-screen items-center justify-center bg-canvas p-8 text-ink" aria-busy="true"><Spinner size="lg" label="Cargando panel…" /></div>;
}
