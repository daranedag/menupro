'use client';
import Link from 'next/link';
import MenuSection from './menu/MenuSection';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function PublicMenuView({ restaurant, menu }) {
  const theme = restaurant.theme;
  return <ThemeProvider initialTheme={theme}><div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-slate-950 px-6 py-12 text-center text-white" style={theme ? { backgroundColor: theme.colors.primary, fontFamily: theme.font.fontFamily } : {}}>
      <p className="text-sm uppercase tracking-widest opacity-70">Carta digital</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">{restaurant.name}</h1>
      {restaurant.address && <p className="mt-3 text-sm opacity-80">{restaurant.address}{restaurant.city ? ', ' + restaurant.city : ''}</p>}
    </header>
    <main className="mx-auto max-w-4xl px-5 py-10" style={theme ? { fontFamily: theme.font.fontFamily } : {}}>
      <div className="mb-10 text-center"><h2 className="text-3xl font-bold">{menu.icon} {menu.name}</h2>{menu.description && <p className="mt-3 text-slate-500">{menu.description}</p>}</div>
      {menu.sections.length ? menu.sections.map(section => <MenuSection key={section.id} section={section} />) : <p className="py-12 text-center text-slate-500">Pronto encontrarás aquí los platos de esta carta.</p>}
      {menu.showCallToAction && (menu.phoneNumber || menu.deliveryUrl) && <section className="mt-12 rounded-2xl bg-indigo-600 p-8 text-center text-white"><h2 className="text-2xl font-bold">{menu.ctaTitle || '¿Te gustó nuestro menú?'}</h2><p className="mt-3">{menu.ctaDescription || 'Reserva tu mesa o haz tu pedido.'}</p><div className="mt-5 flex justify-center gap-4">{menu.phoneNumber && <a className="rounded-lg bg-white px-5 py-3 text-indigo-700" href={'tel:' + menu.phoneNumber}>Llamar</a>}{menu.deliveryUrl && <a className="rounded-lg bg-white px-5 py-3 text-indigo-700" href={menu.deliveryUrl} target="_blank" rel="noopener noreferrer">Hacer un pedido</a>}</div></section>}
    </main>
    <footer className="border-t border-slate-200 p-6 text-center text-xs text-slate-400">Carta digital creada con <Link href="/" className="font-semibold text-slate-600">MenuPro</Link></footer>
  </div></ThemeProvider>;
}
