'use client';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
export default function CommercialAdmin({ onChanged }) {
  const [settings, setSettings] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { let current = true; api.get('/api/admin/commercial').then(result => { if (current) setSettings(result.data); }).catch(failure => { if (current) setError(failure.message); }); return () => { current = false; }; }, []);
  async function toggle(key, checked) {
    const previous = settings;
    const next = { grupo_enabled: settings.grupo_enabled, annual_enabled: settings.annual_enabled, [key]: checked };
    setSettings(next);
    setBusy(true); setError(''); setMessage('');
    try { const result = await api.post('/api/admin/commercial', next); setSettings(result.data); setMessage('Disponibilidad actualizada en la landing y en las nuevas contrataciones.'); await onChanged?.(); }
    catch (failure) { setSettings(previous); setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="rounded-xl border bg-surface p-5"><h2 className="text-xl font-semibold">Planes disponibles para contratar</h2>
    <p className="mt-2 text-sm">Local mensual está disponible para el lanzamiento. Activa cada opción cuando quieras ofrecerla. Al desactivarla, aparecerá como «Próximamente»; las suscripciones ya contratadas conservan sus condiciones.</p>
    <div className="mt-5 space-y-4">{[['grupo_enabled','Habilitar plan Grupo','Permite contratar Grupo para hasta 3 restaurantes.'],['annual_enabled','Habilitar modalidad anual','Permite contratar 12 meses con un pago anual.']].map(([key,label,description]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
      <input type="checkbox" role="switch" aria-label={label} checked={settings?.[key] === true} disabled={!settings || busy} onChange={event => toggle(key, event.target.checked)} className="mt-1 h-5 w-5 accent-action" />
      <span><strong className="block text-sm">{label}</strong><span className="mt-1 block text-sm text-muted">{description}</span><span className="mt-1 block text-xs text-muted">{settings?.[key] ? 'Disponible' : 'Próximamente'}</span></span>
    </label>)}</div>
    <p className="mt-3 text-xs text-muted">La habilitación de los cobros reales de Mercado Pago se realiza por separado.</p>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-800">{message}</p>}
  </section>;
}
