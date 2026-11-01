const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const id = value => { const result = String(value); if (!idPattern.test(result)) throw new Error('Recurso de pago inválido.'); return result; };

/** Scan every page before applying invoices in debit-date order. Persist work
 * between bounded runs; never infer a successful charge from authorization. */
export async function recoverPayments({ rpc, mp, reconcileInvoice, reconcilePayment, reconcilePreapproval,
  syncAmount, uuid, now = Date.now, budgetMs = 40000, requestId = /** @type {string | null} */ (null), onFailure = (_error, _requestId) => {} }) {
  const started = now(); let checked = 0; let failures = 0; let recovered = 0;
  for (let count = 0; count < 20 && now() - started < budgetMs; count++) {
    const token = uuid();
    const job = await rpc('menupro_claim_reconciliation', { p_token: token, p_request_id: requestId });
    if (!job) break;
    let state = job.state ?? { offset: 0, phase: 'scan', pending: [] };
    let done = false;
    const save = (failed = false) => rpc('menupro_save_reconciliation', {
      p_request_id: job.id, p_token: token, p_state: state, p_done: done, p_failed: failed });
    try {
      let provider = job.provider_id;
      if (!provider && job.purpose === 'subscription') {
        const found = await mp('/preapproval/search?external_reference=' + encodeURIComponent(job.id));
        const matches = (found.results ?? []).filter(item => item.external_reference === job.id && ['pending', 'authorized'].includes(item.status));
        if (matches.length > 1) throw new Error('Hay más de una suscripción para esta contratación.');
        if (matches.length === 1) {
          provider = id(matches[0].id);
          await rpc('menupro_bind_checkout', { p_request_id: job.id, p_provider_id: provider, p_url: matches[0].init_point });
        }
      }
      if (!provider && job.purpose === 'subscription') { done = true; await save(); checked++; if (requestId) break; continue; }
      if (job.purpose === 'subscription') await reconcilePreapproval(id(provider));
      if (state.phase === 'scan') {
        const prefix = job.purpose === 'subscription'
          ? '/authorized_payments/search?preapproval_id=' + encodeURIComponent(provider)
          : '/v1/payments/search?external_reference=' + encodeURIComponent(job.id) + '&sort=date_created&criteria=asc';
        // Authorized-payment search defaults to 12 and rejects larger limits
        // accepted by the separate Payments API. Ten works for subscriptions.
        const page = await mp(prefix + '&limit=' + (job.purpose === 'subscription' ? 10 : 50) + '&offset=' + state.offset);
        if (!Array.isArray(page.results) || !Number.isSafeInteger(page.paging?.total) || page.paging.offset !== state.offset ||
            (page.results.length === 0 && state.offset < page.paging.total)) throw new Error('Paginación de cobros incompleta.');
        const entries = page.results.map(item => {
          if (job.purpose === 'subscription' && String(item.preapproval_id) !== String(provider)) throw new Error('Suscripción distinta.');
          if (job.purpose !== 'subscription' && item.external_reference !== job.id) throw new Error('Referencia distinta.');
          const due = item.debit_date ?? item.date_created;
          if (!Number.isFinite(Date.parse(due))) throw new Error('Falta la fecha del cobro.');
          return { id: id(item.id), due };
        });
        const all = new Map([...state.pending, ...entries].map(item => [item.id, item]));
        if (all.size > 2000) throw new Error('El historial requiere revisión administrativa.');
        state = { offset: state.offset + page.results.length, phase: state.offset + page.results.length >= page.paging.total ? 'apply' : 'scan',
          pending: [...all.values()].sort((a, b) => Date.parse(a.due) - Date.parse(b.due) || a.id.localeCompare(b.id)) };
        await save();
      }
      if (state.phase === 'apply') {
        while (state.pending.length && now() - started < budgetMs) {
          const entry = state.pending[0];
          if (job.purpose === 'subscription') await reconcileInvoice(entry.id); else await reconcilePayment(entry.id);
          state = { ...state, pending: state.pending.slice(1) };
          // A lost acknowledgement replays the same provider ID; SQL is idempotent.
          await save(); recovered++;
        }
        done = state.pending.length === 0;
        if (done && provider && job.purpose === 'subscription') await syncAmount(id(provider));
      }
      await save(); checked++;
    } catch (error) {
      failures++;
      onFailure(error, job.id);
      await save(true);
    }
    if (requestId) break;
  }
  return { checked, recovered, failures };
}
