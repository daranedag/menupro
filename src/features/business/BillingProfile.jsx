'use client';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';

export default function BillingProfile({ profile, onSaved, onDirty }) {
  const [form, setForm] = useState({ rut: '', legalName: '', address: '', commune: '', email: '', withholdingParty: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { if (profile) { setForm({ rut: profile.rut, legalName: profile.legal_name, address: profile.address,
    commune: profile.commune, email: profile.email, withholdingParty: profile.withholding_party }); onDirty(false); } }, [profile, onDirty]);
  function change(key, value) { setNotice(''); onDirty(true); setForm(previous => ({ ...previous, [key]: value })); }
  return <section className="rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Datos para la boleta de honorarios</h3>
    <p className="mt-2 text-sm">Emitimos boletas de honorarios manualmente. Ingresa los datos del receptor antes de contratar. No se emiten facturas en esta etapa.</p>
    <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); setNotice('');
      try { await api.post('/api/billing/profile', form); await onSaved(); setNotice('Datos tributarios guardados.'); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
    }}>
      {[['rut', 'RUT del receptor'], ['legalName', 'Nombre completo o razón social'], ['address', 'Domicilio tributario'], ['commune', 'Comuna'], ['email', 'Correo para la boleta']].map(([key, label]) =>
        <Input key={key} label={label} name={key} type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={event => change(key, event.target.value)} required forceLight />)}
      <label className="text-sm font-medium">Modalidad tributaria<select name="withholdingParty" required value={form.withholdingParty} onChange={event => change('withholdingParty', event.target.value)} className="mt-2 w-full rounded border p-2">
        <option value="">Seleccionar modalidad</option>
        <option value="recipient">El receptor retiene y paga al SII</option><option value="emitter">El emisor declara y paga su PPM</option></select></label>
      <p className="text-sm sm:col-span-2">Selecciona la modalidad que corresponde al receptor. Si tu empresa debe retener, Mercado Pago cobra el honorario menos la retención y tu empresa debe declarar y pagar esa retención al SII. Si corresponde PPM del emisor, pagas el honorario bruto completo.</p>
      <p className="text-sm sm:col-span-2">Los datos quedan asociados a la contratación. Para modificarlos con una renovación automática activa, primero cancela esa renovación y contrata nuevamente con los datos actualizados.</p>
      {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-800 sm:col-span-2">{notice}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar datos tributarios'}</Button>
    </form></section>;
}
