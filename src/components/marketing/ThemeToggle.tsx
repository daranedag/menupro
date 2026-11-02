'use client';

import { Moon, Sun } from 'lucide-react';
import { setAppearance, useAppearance } from '@/lib/appearance';

export default function ThemeToggle() {
  const mode = useAppearance();

  function toggleTheme() {
    setAppearance(mode === 'dark' ? 'light' : 'dark');
  }

  const label = mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return <button type="button" onClick={toggleTheme} className="marketing-theme-toggle inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line transition hover:bg-[var(--color-bg-soft)]" aria-label={label} title={label} aria-pressed={mode === 'dark'}>
    <Moon size={19} className="marketing-theme-moon" aria-hidden="true" />
    <Sun size={19} className="marketing-theme-sun" aria-hidden="true" />
  </button>;
}
