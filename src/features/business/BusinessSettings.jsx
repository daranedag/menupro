'use client';
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';

const roles = { owner: 'Propietario', manager: 'Administrador', editor: 'Editor de cartas' };
export default function BusinessSettings() {
  const { user, reloadSession } = useAuth();
  const [team, setTeam] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [notices, setNotices] = useState([]);
  const businessId = user?.businessId;
  const owner = user?.businessRole === 'owner';
  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [members, notifications] = await Promise.all([api.get('/api/business/team'), api.get('/api/business/notifications')]);
      setTeam(members.data); setNotices(notifications.data);
    } catch (failure) { setError(failure.message); }
  }, [businessId]);
  useEffect(() => { load(); }, [load]);
  async function run(action, success) {
    setBusy(true); setError(''); setMessage('');
    try { const result = await action(); await reloadSession(); await load(); setMessage(typeof success === 'function' ? success(result) : success); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <DashboardLayout><div className="mx-auto max-w-4xl space-y-6 text-slate-900">
    <div><h2 className="text-2xl font-bold dark:text-white">Mi negocio y equipo</h2><p className="mt-2 text-slate-500">Los restaurantes y la suscripción pertenecen al negocio. Cada integrante usa su propia cuenta.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-900">{message}</p>}
    {(user?.invitations ?? []).map(invitation => <section key={invitation.id} className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <h3 className="font-semibold">Invitación a {invitation.business_name}</h3><p className="my-2">Rol: {roles[invitation.role]}</p>
      <Button disabled={busy} onClick={() => run(() => api.post('/api/business/invitations/accept', { id: invitation.id }), 'Invitación aceptada.')}>Aceptar invitación</Button>
    </section>)}
    <section className="rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Datos del negocio</h3>
      <p className="mt-2">{user?.businesses?.find(b => b.id === businessId)?.name}</p>
      {owner && <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); run(() => api.put('/api/business/name', { name }), 'Nombre actualizado.'); }}>
        <Input label="Nuevo nombre del negocio" name="businessName" value={name} onChange={event => setName(event.target.value)} required maxLength={255} forceLight />
        <Button type="submit" disabled={busy || !name.trim()}>Guardar nombre</Button>
      </form>}
      <a href="/api/business/export" className="mt-5 inline-block font-medium text-indigo-700 underline">Descargar mis datos</a>
    </section>
    <section className="rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Restaurantes del negocio</h3>
      <ul className="mt-3 divide-y">{(user?.restaurants ?? []).map(restaurant => <li key={restaurant.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div><p className="font-medium">{restaurant.name}</p><p className="text-sm text-slate-500">{restaurant.archived_at ? 'Archivado' : restaurant.entitled === false ? 'Fuera del acceso vigente' : 'Activo'}</p></div>
        {['owner', 'manager'].includes(user?.businessRole) && user?.subscription?.has_access && <button className="text-sm text-indigo-700 underline" disabled={busy} onClick={() => {
          if (restaurant.archived_at || window.confirm('¿Archivar este restaurante? Su carta dejará de estar publicada y conservarás su contenido.')) run(() => api.post('/api/business/restaurant/archive', { restaurantId: restaurant.id, archive: !restaurant.archived_at }), restaurant.archived_at ? 'Restaurante restaurado.' : 'Restaurante archivado.');
        }}>{restaurant.archived_at ? 'Restaurar' : 'Archivar'}</button>}
      </li>)}</ul>
    </section>
    <section className="rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Integrantes</h3>
      {!team ? <p className="mt-3">Cargando equipo…</p> : <ul className="mt-3 divide-y">{(team.members ?? []).map(member => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div><p className="break-all font-medium">{member.email}</p><p className="text-sm text-slate-500">{roles[member.role]}</p></div>
        {owner && member.user_id !== user.id && <div className="flex flex-wrap gap-2">
          <select aria-label={`Rol de ${member.email}`} value={member.role} disabled={busy} className="rounded border p-2 text-sm" onChange={event => run(() => api.post('/api/business/members', { userId: member.user_id, action: 'role', role: event.target.value }), 'Rol actualizado.')}>
            <option value="manager">Administrador</option><option value="editor">Editor</option></select>
          <button disabled={busy} className="rounded border px-3 py-2 text-sm text-red-700" onClick={() => {
            if (window.confirm(`¿Quitar el acceso de ${member.email}?`)) run(() => api.post('/api/business/members', { userId: member.user_id, action: 'remove' }), 'Acceso retirado.');
          }}>Quitar acceso</button>
          <button disabled={busy} className="rounded border px-3 py-2 text-sm" onClick={() => {
            if (window.confirm(`¿Transferir la propiedad del negocio a ${member.email}? Pasarás a ser administrador y esta persona gestionará la suscripción y el equipo.`)) run(() => api.post('/api/business/members', { userId: member.user_id, action: 'transfer' }), 'Propiedad transferida.');
          }}>Transferir propiedad</button>
        </div>}
      </li>)}</ul>}
      {owner && <form className="mt-5 space-y-3 border-t pt-5" onSubmit={event => { event.preventDefault(); run(async () => {
        const { data } = await api.post('/api/business/invitations', { email, role }); setInviteUrl(data.url); setEmail(''); return data;
      }, data => data.emailSent ? 'Invitación enviada por correo. También puedes compartir el enlace.' : 'Invitación creada. El correo no se envió; comparte el enlace con la persona invitada.'); }}>
        <Input label="Correo de la persona invitada" name="inviteEmail" type="email" value={email} onChange={event => setEmail(event.target.value)} required forceLight />
        <label className="block text-sm">Permiso <select value={role} onChange={event => setRole(event.target.value)} className="ml-2 rounded border p-2"><option value="editor">Editor de cartas</option><option value="manager">Administrador del restaurante</option></select></label>
        <Button type="submit" disabled={busy}>Crear invitación</Button>
        {inviteUrl && <p className="break-all text-sm">Enlace de invitación: <a className="text-indigo-700 underline" href={inviteUrl}>{inviteUrl}</a></p>}
      </form>}
      {owner && (team?.invitations ?? []).map(invitation => <div key={invitation.id} className="mt-4 flex flex-wrap justify-between gap-3 rounded bg-slate-50 p-3 text-sm">
        <span>{invitation.email} · {roles[invitation.role]} · vence {new Date(invitation.expires_at).toLocaleDateString('es-CL')}</span>
        <button disabled={busy} className="text-red-700 underline" onClick={() => run(() => api.post('/api/business/invitations/revoke', { id: invitation.id }), 'Invitación anulada.')}>Anular invitación</button></div>)}
    </section>
    <section className="rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Avisos de MenuPro</h3>
      {!notices.length && <p className="mt-3 text-slate-500">No tienes avisos pendientes.</p>}
      <ul className="divide-y">{notices.map(notice => <li key={notice.id} className="py-4"><p className="font-semibold">{notice.subject}</p><p className="mt-1 text-sm text-slate-600">{notice.message}</p>
        {!notice.read_at && <button className="mt-2 text-sm text-indigo-700 underline" disabled={busy} onClick={() => run(() => api.post('/api/business/notifications/read', { id: notice.id }), 'Aviso leído.')}>Marcar como leído</button>}</li>)}</ul>
    </section>
  </div></DashboardLayout>;
}
