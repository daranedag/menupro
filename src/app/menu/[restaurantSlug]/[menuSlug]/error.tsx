'use client';
export default function MenuError({ reset }: { reset: () => void }) {
  return <main className="p-12 text-center"><h1 className="text-2xl font-bold">No pudimos cargar la carta</h1><button className="mt-5 rounded-lg bg-indigo-600 px-6 py-3 text-white" onClick={reset}>Reintentar</button></main>;
}
