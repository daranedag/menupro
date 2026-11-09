'use client';
import Link from 'next/link';
import { MapPin, UtensilsCrossed } from 'lucide-react';
import MenuSection from './menu/MenuSection';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { getVisibleMenu } from '@/lib/menu.mjs';

export default function PublicMenuView({ restaurant, menu }) {
  menu = getVisibleMenu(menu);
  const theme = restaurant.theme;
  const dark = theme?.mode === 'dark';
  const style = {
    ...(theme ? { '--menu-primary': theme.colors.primary, fontFamily: theme.font.fontFamily } : {}),
    ...(dark ? { '--menu-text': '#e5e7eb', '--menu-muted': '#adb5b0', '--menu-line': '#343e38', '--menu-bg': '#161a18', '--menu-canvas': '#0f1211', colorScheme: 'dark' } : {}),
  };
  return <ThemeProvider initialTheme={theme}><div className="public-menu" style={style}>
    <header className="public-menu-header"><UtensilsCrossed size={28} strokeWidth={1.3} aria-hidden="true" className="mx-auto" /><h1>{restaurant.name}</h1>
      {restaurant.address && <p className="flex items-center justify-center gap-2"><MapPin size={14} aria-hidden="true" />{restaurant.address}{restaurant.city ? ', ' + restaurant.city : ''}</p>}
    </header>
    <main className="public-menu-main">
      <div className="public-menu-title"><h2>{menu.icon} {menu.name}</h2>{menu.description && <p>{menu.description}</p>}</div>
      {menu.sections.length > 1 && <nav aria-label="Secciones de la carta" className="public-menu-sections">{menu.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.name}</a>)}</nav>}
      {menu.sections.length ? menu.sections.map(section => <MenuSection key={section.id} section={section} />) : <p className="py-12 text-center" style={{ color: 'var(--menu-muted)' }}>Pronto encontrarás aquí los platos de esta carta.</p>}
      {menu.showCallToAction && (menu.phoneNumber || menu.deliveryUrl) && <section className="public-menu-cta"><h2>{menu.ctaTitle || '¿Te gustó nuestro menú?'}</h2><p>{menu.ctaDescription || 'Reserva tu mesa o haz tu pedido.'}</p><div>{menu.phoneNumber && <a href={'tel:' + menu.phoneNumber}>Llamar</a>}{menu.deliveryUrl && <a href={menu.deliveryUrl} target="_blank" rel="noopener noreferrer">Hacer un pedido</a>}</div></section>}
    </main>
    <footer className="public-menu-footer">Carta digital creada con <Link href="/">MenuPro</Link></footer>
  </div></ThemeProvider>;
}
