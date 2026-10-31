'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';

export default function TrialOnboarding() {
  const { user, createRestaurant, reloadSession } = useAuth();
  const restaurant = user?.restaurants?.find(r => r.id === user.activeRestaurantId);
  const [form, setForm] = useState(() => ({ name: restaurant?.name || '', phone: restaurant?.phone || '',
    address: restaurant?.address || '', city: restaurant?.city || '', unit: restaurant?.unit || '', noPhysicalLocation: restaurant?.no_physical_location || false, acceptTerms: false }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const review = user?.subscription?.effective_status === 'review';
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  async function start(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const current = restaurant || await createRestaurant({ name: form.name, phone: form.phone, address: form.address, city: form.city, unit: form.unit, no_physical_location: form.noPhysicalLocation });
      await api.post('/api/business/trial', { ...form, restaurantId: current.id });
      await reloadSession(); window.location.reload();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-8">
    <p className="text-sm font-semibold text-indigo-600">Tu restaurante en MenuPro</p>
    <h2 className="mt-2 text-2xl font-bold">{review ? 'Estamos revisando tu solicitud' : 'Activa tu demo gratis de 15 días'}</h2>
    {review ? <><p className="mt-4 text-slate-600">Necesitamos verificar los datos del negocio antes de activar la demo. No se ha iniciado el plazo y no se realizará ningún cobro.</p>
      <Link href="/contacto" className="mt-5 inline-block text-indigo-700 underline">Contactar a soporte</Link></> : <>
      <p className="mt-3 text-slate-600">Sin tarjeta. Incluye una carta de ejemplo editable, publicación, QR y PDF. Si continúas, conservas todo tu trabajo.</p>
      {user?.businessRole !== 'owner' ? <p className="mt-5">El propietario del negocio debe activar la demo.</p> : <form onSubmit={start} className="mt-6 space-y-4">
        <Input label="Nombre del restaurante" name="name" value={form.name} onChange={change} required maxLength={255} forceLight />
        <Input label="Teléfono del negocio" name="phone" type="tel" placeholder="+56 9 1234 5678" value={form.phone} onChange={change} required maxLength={30} forceLight />
        <label className="flex items-center gap-2 text-sm"><input name="noPhysicalLocation" type="checkbox" checked={form.noPhysicalLocation} onChange={change} /> Mi negocio no tiene atención presencial</label>
        {!form.noPhysicalLocation && <><Input label="Dirección" name="address" value={form.address} onChange={change} required maxLength={255} forceLight />
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Comuna" name="city" value={form.city} onChange={change} required maxLength={255} forceLight />
            <Input label="Número de local o unidad (opcional)" name="unit" value={form.unit} onChange={change} maxLength={255} forceLight /></div></>}
        <label className="flex items-start gap-2 text-sm"><input name="acceptTerms" type="checkbox" checked={form.acceptTerms} onChange={change} required className="mt-1" />
          <span>Acepto los <Link href="/terminos" className="text-indigo-700 underline" target="_blank">términos</Link> y la <Link href="/privacidad" className="text-indigo-700 underline" target="_blank">privacidad</Link>, incluyendo una demo por negocio y la verificación de posibles registros repetidos.</span></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy || !form.acceptTerms} fullWidth>{busy ? 'Preparando tu demo…' : 'Activar demo gratis'}</Button>
      </form>}
    </>}
    {(user?.invitations?.length ?? 0) > 0 && <Link href="/app/dashboard/business" className="mt-5 block text-indigo-700 underline">Tienes invitaciones a otros negocios. Revísalas antes de comenzar.</Link>}
  </section>;
}
