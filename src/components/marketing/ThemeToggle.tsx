'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function readPreference() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* The toggle still works when browser storage is unavailable. */ }
  return null;
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    function syncTheme() {
      const next = readPreference()
        ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.marketingTheme = next;
      setMode(next);
    }
    syncTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'theme' || event.key === null) syncTheme();
    };
    media.addEventListener('change', syncTheme);
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', syncTheme);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function toggleTheme() {
    const next = document.documentElement.dataset.marketingTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.marketingTheme = next;
    setMode(next);
    try { localStorage.setItem('theme', next); } catch { /* Keep the in-memory choice. */ }
  }

  const label = mode === null ? 'Cambiar tema' : mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return <button type="button" onClick={toggleTheme} className="marketing-theme-toggle inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-default transition hover:bg-[var(--color-bg-soft)]" aria-label={label} title={label} aria-pressed={mode === 'dark'}>
    <Moon size={19} className="marketing-theme-moon" aria-hidden="true" />
    <Sun size={19} className="marketing-theme-sun" aria-hidden="true" />
  </button>;
}
