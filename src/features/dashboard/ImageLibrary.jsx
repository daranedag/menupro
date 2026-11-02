'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Card } from '@/components/ui';
import DashboardLayout from '@/layouts/DashboardLayout';

export function ImagePicker({ onSelect }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [images, setImages] = useState([]);
  const [offset, setOffset] = useState(null);
  const [search, setSearch] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setState(null); setImages([]); setOffset(null); setLoaded(false); setError(''); setSearch(''); setPath('');
    api.get('/api/images').then(({ data }) => { if (active) setState(data); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [user?.businessId]);
  async function load(next = 0) {
    setBusy(true); setError('');
    try { const { data } = await api.get('/api/images/catalog', { params: { offset: next } }); setImages(data.images); setOffset(data.nextOffset); setLoaded(true); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function choose(image) {
    setBusy(true); setError('');
    try { const { data } = await api.post('/api/images/assets', image); onSelect(data); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section aria-label="Biblioteca de imágenes" className="space-y-4 rounded-lg border border-line p-4">
    <div><h3 className="font-semibold text-ink">Elegir desde mi servidor</h3><p className="mt-1 text-sm text-muted">Opcional. También puedes guardar el plato sin imagen.</p></div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!state && !error && <p role="status" className="text-sm text-muted">Cargando conexión…</p>}
    {state && !state.eligible && <p className="text-sm text-muted">Disponible con una suscripción pagada vigente. <Link href="/app/dashboard/billing" className="underline">Ver suscripción</Link></p>}
    {state?.eligible && !state.source && <p className="text-sm text-muted"><Link href="/app/dashboard/images" className="underline">Conecta tu servidor de imágenes</Link> cuando quieras usar tu biblioteca.</p>}
    {state?.eligible && state.source && <>
      <p className="text-sm text-muted">{state.source.name} · <Link href="/app/dashboard/images" className="underline">Configurar conexión</Link></p>
      {state.source.provider === 'imagekit' && <>
        <Button variant="outline" disabled={busy} onClick={() => load(0)}>{busy ? 'Consultando…' : 'Explorar ImageKit'}</Button>
        {images.length > 0 && <Input label="Filtrar imágenes de esta página" value={search} onChange={event => setSearch(event.target.value)} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{images.filter(image => image.name.toLowerCase().includes(search.toLowerCase())).map(image => <button key={image.url} type="button" disabled={busy} onClick={() => choose({ url: image.url, name: image.name })} className="overflow-hidden rounded-lg border border-line text-left focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50">
          <img src={image.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-28 w-full object-cover" />
          <span className="block break-words p-2 text-sm text-ink">{image.name}</span><span className="sr-only">Elegir imagen</span>
        </button>)}</div>
        {offset !== null && <Button variant="outline" disabled={busy} onClick={() => load(offset)}>Siguiente página</Button>}
        {loaded && images.length === 0 && <p className="text-sm text-muted">No hay imágenes públicas en esta página.{offset !== null ? ' Puedes continuar a la siguiente.' : ' Revisa la carpeta y la dirección del servidor conectado.'}</p>}
      </>}
      <Input label="Ruta o enlace de una imagen" value={path} onChange={event => setPath(event.target.value)} placeholder="platos/pizza.jpg" helperText={`Dentro de ${state.source.base_url}/. Usa imágenes públicas y permanentes.`} />
      <Button variant="outline" disabled={busy || !path.trim()} onClick={() => choose({ url: path.trim(), name: path.split('/').pop() || 'Imagen del plato' })}>Usar esta imagen</Button>
    </>}
  </section>;
}

export default function ImageLibrary() {
  const { user } = useAuth();
  return <DashboardLayout><div className="mx-auto max-w-3xl space-y-6"><div><h2 className="text-3xl font-bold text-ink">Imágenes de tus platos</h2><p className="mt-2 text-muted">Conecta tu biblioteca si quieres agregar fotos. Tus cartas pueden funcionar solo con texto.</p></div><ImageConnection key={user?.businessId} /></div></DashboardLayout>;
}

function ImageConnection() {
  const [state, setState] = useState(null);
  const [form, setForm] = useState({ provider: 'imagekit', name: 'Mi biblioteca', baseUrl: '', folder: '/', privateKey: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  async function refresh() {
    const { data } = await api.get('/api/images'); setState(data);
    if (data.source) setForm({ provider: data.source.provider, name: data.source.name, baseUrl: data.source.base_url, folder: data.source.folder, privateKey: '' });
  }
  useEffect(() => { let active = true;
    api.get('/api/images').then(({ data }) => { if (!active) return; setState(data); if (data.source) setForm({ provider: data.source.provider, name: data.source.name, baseUrl: data.source.base_url, folder: data.source.folder, privateKey: '' }); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, []);
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await api.put('/api/images/source', { ...form, privateKey: form.privateKey || undefined }); setForm(previous => ({ ...previous, privateKey: '' })); await refresh(); setMessage('Servidor conectado. Ya puedes elegir imágenes al editar un plato.'); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setError(''); setMessage('');
    try { await api.delete('/api/images/source'); await refresh(); setForm(previous => ({ ...previous, privateKey: '' })); setDisconnecting(false); setMessage('Servidor desconectado. Las imágenes ya asignadas a platos conservan sus enlaces.'); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <Card title="Servidor de imágenes" subtitle="Tus fotos siguen alojadas en tu propia cuenta.">
    <div className="space-y-5">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}{message && <p role="status" className="text-sm text-ink">{message}</p>}
      {!state && !error && <p role="status">Cargando conexión…</p>}
      {state && !state.eligible && <p className="text-muted">Esta opción requiere una suscripción pagada vigente. La prueba gratuita y las cortesías no la incluyen. <Link href="/app/dashboard/billing" className="underline">Ver suscripción</Link></p>}
      {state?.source && <p className="text-sm text-muted">Conectado: <strong className="text-ink">{state.source.name}</strong></p>}
      {state?.eligible && !state.canManage && <p className="text-muted">El propietario o un encargado configura la conexión. Puedes elegir imágenes desde los platos.</p>}
      {state?.canManage && <form onSubmit={save} className="space-y-5">
        <label className="block text-sm font-medium text-ink">Servicio<select name="provider" value={form.provider} onChange={change} className="ui-input mt-2 w-full border border-line bg-surface p-3 text-ink"><option value="imagekit">ImageKit</option><option value="public">Otro servidor o CDN público</option></select></label>
        <Input label="Nombre de la biblioteca" name="name" value={form.name} onChange={change} maxLength={100} required />
        <Input label="Dirección pública del servidor" name="baseUrl" type="url" value={form.baseUrl} onChange={change} placeholder="https://ik.imagekit.io/tu-cuenta" helperText="La dirección desde la que se sirven tus imágenes, sin claves ni parámetros." required />
        {form.provider === 'imagekit' && <>
          <Input label="Carpeta de ImageKit" name="folder" value={form.folder} onChange={change} placeholder="/platos" helperText="Usa / para consultar toda la biblioteca. Solo se muestran imágenes públicas." required />
          <Input label="Clave privada de ImageKit" name="privateKey" type="password" value={form.privateKey} onChange={change} autoComplete="new-password" placeholder={state.source?.provider === 'imagekit' ? 'Deja vacío para conservar la clave guardada' : 'private_…'} helperText="Usa una clave restringida con permiso de solo lectura de medios. Se guarda cifrada." required={state.source?.provider !== 'imagekit'} />
          {!state.imagekitReady && <p className="text-sm text-muted">La conexión de ImageKit aún debe ser habilitada por MenuPro.</p>}
        </>}
        {form.provider === 'public' && <p className="text-sm text-muted">Compatible con enlaces públicos de Cloudinary, S3 y otros servidores. Agregarás la ruta de cada imagen desde el plato; la exploración automática está disponible para ImageKit.</p>}
        <Button type="submit" disabled={busy || (form.provider === 'imagekit' && !state.imagekitReady)}>{busy ? 'Guardando…' : 'Guardar conexión'}</Button>
      </form>}
      {state?.source && (state.canManage || state.canDisconnect) && <div className="border-t border-line pt-4">
        {!disconnecting ? <Button variant="ghost" disabled={busy} onClick={() => setDisconnecting(true)}>Desconectar servidor</Button> : <div className="space-y-3"><p className="text-sm text-muted">Se eliminará la conexión y su clave. Las imágenes de tus platos conservarán sus enlaces.</p><div className="flex flex-wrap gap-3"><Button variant="danger" disabled={busy} onClick={disconnect}>Confirmar desconexión</Button><Button variant="ghost" onClick={() => setDisconnecting(false)}>Cancelar</Button></div></div>}
      </div>}
    </div>
  </Card>;
}
