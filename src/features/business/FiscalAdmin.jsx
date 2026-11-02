'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';
const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
const deliveryLabels = { not_sent: 'Sin enviar', queued: 'En cola de envío', sending: 'Envío en curso', failed: 'Envío fallido; se reintentará', unknown: 'Revisar el resultado en Resend antes de reintentar', accepted: 'Aceptada por Resend para envío', delivered: 'Entregada al servidor de correo del cliente', bounced: 'Correo rechazado; revisar dirección y Resend', complained: 'El destinatario marcó el correo como no deseado', delayed: 'Entrega demorada; Resend está reintentando' };
export default function FiscalAdmin() {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('pending'); const [offset, setOffset] = useState(0); const [entries, setEntries] = useState({});
  const load = useCallback(async () => { const result = await api.get(`/api/admin/fiscal?status=${filter}&offset=${offset}`); setData(result.data); }, [filter, offset]);
  useEffect(() => { load().catch(failure => setError(failure.message)); }, [load]);
  return <section className="rounded-xl border bg-surface p-5"><h2 className="text-xl font-semibold">Boletas de honorarios · emisión manual</h2>
    <p className="mt-2 text-sm">Genera la boleta en el SII con los datos de cada pago. Registra el folio y la fecha, sube su PDF y envíalo al correo del cliente con Resend. Los PDF se guardan de forma privada.</p>
    <div className="mt-4 flex gap-4"><select aria-label="Estado de boletas" value={filter} onChange={event => { setFilter(event.target.value); setOffset(0); }} className="rounded border p-2"><option value="pending">Por preparar o enviar</option><option value="issued">Emitidas</option><option value="all">Todas</option></select><button className="text-brand underline" onClick={() => load().catch(failure => setError(failure.message))}>Actualizar bandeja</button></div>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-800">{message}</p>}
    {(data?.documents ?? []).map(document => {
      const recipient = document.billing_snapshot;
      const entry = entries[document.payment_id] ?? { folio: document.folio || '', issuedDate: document.issued_date || document.expected_issue_date, pdf: null };
      const change = (key, value) => setEntries(previous => ({ ...previous, [document.payment_id]: { ...entry, [key]: value } }));
      const sent = Boolean(document.email_accepted_at); const frozen = Boolean(document.email_queued_at);
      return <article key={document.payment_id} className="mt-5 rounded border p-4 text-sm"><h3 className="font-semibold">{recipient.legal_name} · {recipient.rut}</h3>
        <p className="mt-2">{recipient.address}, {recipient.commune}</p><p className="mt-1 font-medium">Enviar a: {recipient.email}</p><p className="mt-1 break-all text-xs text-muted">Pago: {document.payment_id} · {document.expected_issue_date}</p>
        <p className="mt-3">Honorario bruto: {money(document.honorarium_gross)} · Retención del receptor: {money(document.withholding_amount)} · Pagado: {money(document.paid_amount)}</p>
        <p>{recipient.withholding_party === 'recipient' ? 'El receptor retiene y paga al SII.' : 'El emisor declara y paga PPM.'} Tasa: {Number((document.retention_rate * 100).toFixed(2))}%.</p>
        {document.review_required && <p role="alert" className="mt-2 font-semibold text-amber-800">Requiere revisión tributaria por devolución, disputa o diferencia de año.</p>}
        {document.status === 'issued' && <p className="mt-3 font-semibold">Boleta N.º {document.folio} · {document.issued_date}</p>}
        {!frozen && <form className="mt-4 flex flex-wrap items-end gap-4" onSubmit={async event => {
          event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setError(''); setMessage('');
          try {
            if (!entry.pdf) throw new Error('Selecciona el PDF de la boleta.');
            const form = new FormData(); form.set('paymentId', document.payment_id); form.set('folio', entry.folio); form.set('issuedDate', entry.issuedDate); form.set('pdf', entry.pdf);
            await api.post('/api/admin/fiscal/upload', form, { headers: { 'Content-Type': undefined } });
            formElement.reset(); change('pdf', null); await load(); setMessage('PDF y folio guardados. Ya puedes enviar la boleta al cliente.');
          } catch (failure) { setError(failure.message); } finally { setBusy(false); }
        }}>
          <Input label="Folio emitido en el SII" name={'folio-' + document.payment_id} value={entry.folio} onChange={event => change('folio', event.target.value)} pattern="[0-9]{1,20}" readOnly={document.status === 'issued'} required />
          <Input label="Fecha de emisión" name={'date-' + document.payment_id} type="date" value={entry.issuedDate} onChange={event => change('issuedDate', event.target.value)} readOnly={document.status === 'issued'} required />
          <label className="block max-w-xs text-sm font-medium">PDF de la boleta · máximo 2 MB<input aria-label={'PDF de la boleta ' + document.payment_id} type="file" accept="application/pdf,.pdf" onChange={event => change('pdf', event.target.files?.[0] || null)} className="mt-2 block w-full text-xs" required /></label>
          <Button disabled={busy || document.review_required || !entry.pdf} type="submit">Guardar PDF y folio</Button>
        </form>}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {document.storage_key && <a className="text-brand underline" href={'/api/admin/fiscal/file?paymentId=' + encodeURIComponent(document.payment_id)}>Descargar PDF guardado</a>}
          <Button disabled={busy || !document.storage_key || document.review_required || !['not_sent','failed','queued'].includes(document.delivery_state)} onClick={async () => {
            setBusy(true); setError(''); setMessage('');
            try { const result = await api.post('/api/admin/fiscal/send', { paymentId: document.payment_id }); setMessage(result.data.message); await load(); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
          }}>{sent ? 'Envío registrado' : 'Enviar boleta por correo'}</Button>
          <span className={['failed','unknown','bounced','complained'].includes(document.delivery_state) ? 'text-amber-800' : 'text-muted'}>{deliveryLabels[document.delivery_state] || 'Sin enviar'}</span>
        </div>
        {frozen && <p className="mt-3 text-xs text-muted">El folio y el PDF quedan protegidos al iniciar el envío. Los reintentos usan el mismo documento.</p>}
      </article>;
    })}
    {data && !data.documents.length && <p className="mt-4 text-sm">No hay boletas en esta vista.</p>}
    {data && <div className="mt-4 flex items-center gap-4 text-sm"><Button disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Anterior</Button><span>{data.total} boletas</span><Button disabled={offset + 50 >= data.total} onClick={() => setOffset(value => value + 50)}>Siguiente</Button></div>}
    <h3 className="mt-6 font-semibold">Conciliación automática</h3><p className="mt-2 text-sm">{data?.jobs?.filter(job => job.failures > 0).length ?? 0} contrataciones con errores pendientes de reintento entre los 100 registros mostrados.</p>
  </section>;
}
