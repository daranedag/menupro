'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';
const money = value => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
export default function FiscalAdmin() {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('pending'); const [offset, setOffset] = useState(0); const [entries, setEntries] = useState({});
  const load = useCallback(async () => { try { setData((await api.get(`/api/admin/fiscal?status=${filter}&offset=${offset}`)).data); } catch (failure) { setError(failure.message); } }, [filter, offset]);
  useEffect(() => { load(); }, [load]);
  return <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Boletas de honorarios · emisión manual</h2>
    <p className="mt-2 text-sm">Emite y entrega la boleta desde el SII usando los datos y montos de cada pago. Luego registra aquí el folio y la fecha. El aviso de registro se envía por Resend; no adjunta ni genera el documento del SII.</p>
    <div className="mt-4 flex gap-4"><select aria-label="Estado de boletas" value={filter} onChange={event => { setFilter(event.target.value); setOffset(0); }} className="rounded border p-2"><option value="pending">Pendientes</option><option value="issued">Emitidas</option><option value="all">Todas</option></select><button className="text-indigo-700 underline" onClick={load}>Actualizar bandeja</button></div>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {(data?.documents ?? []).filter(document => filter === 'all' || document.status === filter).map(document => {
      const recipient = document.billing_snapshot; const entry = entries[document.payment_id] ?? { folio: '', issuedDate: document.expected_issue_date };
      const change = (key, value) => setEntries(previous => ({ ...previous, [document.payment_id]: { ...entry, [key]: value } }));
      return <article key={document.payment_id} className="mt-5 rounded border p-4 text-sm"><h3 className="font-semibold">{recipient.legal_name} · {recipient.rut}</h3>
        <p className="mt-2">{recipient.address}, {recipient.commune} · {recipient.email}</p><p>Pago: {document.payment_id} · {document.expected_issue_date}</p>
        <p className="mt-2">Honorario bruto: {money(document.honorarium_gross)} · Retención del receptor: {money(document.withholding_amount)} · Pagado: {money(document.paid_amount)}</p>
        <p>{recipient.withholding_party === 'recipient' ? 'El receptor retiene y paga al SII.' : 'El emisor declara y paga PPM.'} Tasa: {Number((document.retention_rate * 100).toFixed(2))}%.</p>
        {document.review_required && <p role="alert" className="mt-2 font-semibold text-amber-800">Requiere revisión tributaria por devolución, disputa o diferencia de año. No anula automáticamente una boleta del SII.</p>}
        {document.status === 'issued' ? <p className="mt-3 font-semibold">Boleta N.º {document.folio} · {document.issued_date}</p> : <form className="mt-4 flex flex-wrap items-end gap-4" onSubmit={async event => { event.preventDefault(); setBusy(true); setError('');
          try { await api.post('/api/admin/fiscal/issue', { paymentId: document.payment_id, ...entry }); await load(); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
        }}><Input label="Folio emitido en el SII" name={'folio-' + document.payment_id} value={entry.folio} onChange={event => change('folio', event.target.value)} pattern="[0-9]{1,20}" required forceLight />
          <Input label="Fecha de emisión" name={'date-' + document.payment_id} type="date" value={entry.issuedDate} onChange={event => change('issuedDate', event.target.value)} required forceLight />
          <Button disabled={busy || document.review_required} type="submit">Registrar boleta emitida y avisar</Button></form>}
      </article>;
    })}
    {data && !data.documents.some(document => filter === 'all' || document.status === filter) && <p className="mt-4 text-sm">No hay boletas en esta vista.</p>}
    {data && <div className="mt-4 flex items-center gap-4 text-sm"><Button disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Anterior</Button><span>{data.total} boletas</span><Button disabled={offset + 50 >= data.total} onClick={() => setOffset(value => value + 50)}>Siguiente</Button></div>}
    <h3 className="mt-6 font-semibold">Conciliación automática</h3><p className="mt-2 text-sm">{data?.jobs?.filter(job => job.failures > 0).length ?? 0} contrataciones con errores pendientes de reintento entre los 100 registros mostrados.</p>
    {(data?.jobs ?? []).filter(job => job.failures > 0).map(job => <p key={job.request_id} className="mt-2 break-all text-sm text-amber-800">{job.request_id} · {job.failures} fallos · Próximo intento: {new Date(job.next_attempt_at).toLocaleString('es-CL')}</p>)}
  </section>;
}
