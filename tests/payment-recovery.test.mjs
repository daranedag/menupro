import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverPayments } from '../src/lib/payment-recovery.mjs';
function fixture(state = { offset: 0, phase: 'scan', pending: [] }) {
  const saved = []; const invoices = []; let claimed = false;
  const job = { id: 'request-1', provider_id: 'sub-1', purpose: 'subscription', state };
  const rpc = async (name, args) => name === 'menupro_claim_reconciliation' ? (claimed ? null : (claimed = true, job)) : saved.push(structuredClone(args));
  const options = { rpc, uuid: () => 'token', reconcilePreapproval: async () => {}, syncAmount: async () => {},
    reconcileInvoice: async value => invoices.push(value), reconcilePayment: async () => { throw Error('Wrong flow'); },
    mp: async () => ({ paging: { offset: state.offset, total: 2 }, results: [
      { id: 2, preapproval_id: 'sub-1', debit_date: '2026-12-01' }, { id: 1, preapproval_id: 'sub-1', debit_date: '2026-11-01' }] }) };
  return { options, saved, invoices };
}
test('lost notifications recover charges chronologically and acknowledge each provider ID', async () => {
  const f = fixture(); const mp = f.options.mp; f.options.mp = async path => { assert.match(path, /limit=10&offset=0$/); return mp(); };
  const result = await recoverPayments(f.options);
  assert.deepEqual(f.invoices, ['1', '2']); assert.equal(result.recovered, 2);
  assert.equal(f.saved.at(-1).p_done, true); assert.equal(f.saved.at(-1).p_state.pending.length, 0);
});
test('incomplete pages persist progress before any entitlement is applied', async () => {
  const f = fixture(); f.options.mp = async () => ({ paging: { offset: 0, total: 51 }, results: [{ id: 9, preapproval_id: 'sub-1', debit_date: '2026-12-01' }] });
  await recoverPayments(f.options); assert.deepEqual(f.invoices, []);
  assert.equal(f.saved.at(-1).p_state.phase, 'scan'); assert.equal(f.saved.at(-1).p_state.offset, 1);
});
test('provider failures preserve unacknowledged work for a later retry', async () => {
  const f = fixture({ offset: 2, phase: 'apply', pending: [{ id: '1', due: '2026-11-01' }, { id: '2', due: '2026-12-01' }] });
  f.options.reconcileInvoice = async value => { if (value === '2') throw Error('Timeout'); f.invoices.push(value); };
  const result = await recoverPayments(f.options); assert.equal(result.failures, 1);
  assert.deepEqual(f.saved.at(-1).p_state.pending.map(entry => entry.id), ['2']); assert.equal(f.saved.at(-1).p_failed, true);
});
test('foreign resources and broken pagination never grant access', async () => {
  for (const page of [{ paging: { offset: 0, total: 1 }, results: [] }, { paging: { offset: 0, total: 1 }, results: [{ id: 1, preapproval_id: 'foreign', debit_date: '2026-11-01' }] }]) {
    const f = fixture(); f.options.mp = async () => page;
    assert.equal((await recoverPayments(f.options)).failures, 1); assert.deepEqual(f.invoices, []);
  }
});
