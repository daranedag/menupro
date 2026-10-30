'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/api/client';
import Settings from './Settings';

export default function SettingsSave() {
  const { user, reloadSession } = useAuth();
  const { theme } = useTheme();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  return <><Settings /><div className="sticky bottom-0 border-t bg-white p-4 text-center shadow-lg">
    <button className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white disabled:opacity-50" disabled={!user?.activeRestaurantId || saving} onClick={async () => {
      setSaving(true); setMessage('');
      try { await api.patch('/api/restaurants/' + user.activeRestaurantId, { theme }); await reloadSession(); setMessage('Apariencia guardada. Tu carta pública ya usa estos cambios.'); }
      catch (error) { setMessage(error.message); }
      finally { setSaving(false); }
    }}>{saving ? 'Guardando…' : 'Guardar apariencia del restaurante'}</button>
    {message && <p role="status" className="mt-2 text-sm text-slate-700">{message}</p>}
  </div></>;
}
