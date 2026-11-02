'use client';

import { useSyncExternalStore } from 'react';

type Mode = 'light' | 'dark';
const changeEvent = 'menupro:appearance';

function readPreference(): Mode {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* Use the current in-memory choice when storage is unavailable. */ }
  return document.documentElement.dataset.marketingTheme === 'dark' ? 'dark' : 'light';
}

export function setAppearance(mode: Mode) {
  document.documentElement.dataset.marketingTheme = mode;
  try { localStorage.setItem('theme', mode); } catch { /* Keep the in-memory choice. */ }
  window.dispatchEvent(new Event(changeEvent));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  function syncPreference() {
    let saved;
    try { saved = localStorage.getItem('theme'); } catch { /* Keep the in-memory choice. */ }
    if (saved !== 'dark' && saved !== 'light') {
      document.documentElement.dataset.marketingTheme = media.matches ? 'dark' : 'light';
    } else {
      document.documentElement.dataset.marketingTheme = saved;
    }
    onChange();
  }
  function onStorage(event: StorageEvent) {
    if (event.key === 'theme' || event.key === null) syncPreference();
  }
  window.addEventListener(changeEvent, onChange);
  window.addEventListener('storage', onStorage);
  media.addEventListener('change', syncPreference);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', syncPreference);
  };
}

export function useAppearance() {
  return useSyncExternalStore(subscribe, readPreference, () => 'light' as Mode);
}
