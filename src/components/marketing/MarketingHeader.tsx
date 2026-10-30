'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const links = [
  { href: '/', label: 'Inicio' },
  { href: '/quienes-somos', label: 'Quiénes Somos' },
  { href: '/contacto', label: 'Contacto' },
  { href: '/app/login', label: 'Login' },
];

export default function MarketingHeader() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const menuButton = useRef<HTMLButtonElement>(null);

  return <header onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      setOpenPath(null);
      menuButton.current?.focus();
    }
  }}>
    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
      <Link href="/" className="text-lg font-semibold transition hover:text-[var(--color-accent)]">MenuPro</Link>
      <div className="flex items-center gap-4 md:gap-6">
        <nav aria-label="Navegación principal" className="hidden items-center gap-6 md:flex">
          {links.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={`text-sm font-medium transition hover:text-[var(--color-accent)] ${pathname === href ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]' : ''}`}>{label}</Link>)}
        </nav>
        <ThemeToggle />
        <button ref={menuButton} type="button" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="marketing-mobile-menu" onClick={() => setOpenPath(open ? null : pathname)} className="inline-flex size-11 items-center justify-center rounded-xl border border-default transition hover:bg-[var(--color-bg-soft)] md:hidden">{open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}</button>
      </div>
    </div>
    <nav id="marketing-mobile-menu" aria-label="Navegación móvil" hidden={!open} className="border-b border-default bg-[var(--color-bg-soft)] md:hidden">
      <ul className="mx-auto max-w-7xl space-y-1 px-6 py-3">
        {links.map(({ href, label }) => <li key={href}><Link href={href} onClick={() => setOpenPath(null)} aria-current={pathname === href ? 'page' : undefined} className={`block rounded-lg px-3 py-3 text-sm font-medium transition hover:text-[var(--color-accent)] ${pathname === href ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : ''}`}>{label}</Link></li>)}
      </ul>
    </nav>
  </header>;
}
