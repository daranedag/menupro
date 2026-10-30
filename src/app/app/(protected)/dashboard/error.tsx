'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div role="alert" className="p-8"><p>No se pudo cargar el panel.</p><button onClick={reset} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white">Reintentar</button></div>;
}
