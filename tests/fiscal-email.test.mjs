import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deliverFiscalDocuments } from '../src/lib/fiscal-email.mjs';
const bytes = Buffer.from('%PDF-1.4\nprueba\n%%EOF');
const document = { payment_id: 'payment-1', token: 'lease-1', tag_id: 'doc-1', email: 'client@example.invalid', name: 'Cliente <prueba>', folio: '123', issued_date: '2026-11-01', sha256: createHash('sha256').update(bytes).digest('hex'), content: bytes.toString('base64') };
const config = { enabled: true, apiKey: 'fixture-key', from: 'MenuPro <notificaciones@example.invalid>' };
function queue(value = document) {
  const completed = []; let claimed = false;
  return { completed, async rpc(name,args) { if (name === 'menupro_claim_fiscal_delivery') { if (claimed) return null; claimed = true; return value; } assert.equal(name,'menupro_complete_fiscal_delivery'); completed.push(args); } };
}
test('fiscal mail attaches the exact verified PDF to the immutable customer address', async () => {
  const q = queue();
  const result = await deliverFiscalDocuments({ rpc: q.rpc, config, pause: async () => {}, fetchEmail: async (url,options) => {
    assert.equal(url,'https://api.resend.com/emails');
    const payload = JSON.parse(options.body); assert.deepEqual(payload.to,[document.email]);
    assert.match(payload.html,/Cliente &lt;prueba&gt;/); assert.equal(payload.attachments[0].filename,'MenuPro-boleta-123.pdf');
    assert.deepEqual(Buffer.from(payload.attachments[0].content,'base64'),bytes);
    assert.equal(options.headers['Idempotency-Key'],`menupro-fiscal/doc-1/${document.sha256}`);
    assert.deepEqual(payload.tags,[{ name:'application',value:'menupro' },{ name:'menupro_document',value:'doc-1' }]);
    return Response.json({ id: 'email-1' });
  } });
  assert.equal(result.emailed,1); assert.equal(q.completed[0].p_email_id,'email-1');
});
test('a changed attachment is never sent or marked accepted', async () => {
  const q = queue({ ...document, content: Buffer.from('%PDF-alterado').toString('base64') });
  const result = await deliverFiscalDocuments({ rpc:q.rpc,config,fetchEmail:async () => assert.fail('Tampered attachment sent') });
  assert.equal(result.emailFailures,1); assert.equal(q.completed[0].p_email_id,null);
});
test('disabled email does not claim documents; provider rejection leaves a retryable job', async () => {
  await deliverFiscalDocuments({ config:{ ...config,enabled:false },rpc:async () => assert.fail('Disabled job claimed') });
  const q = queue(); const result = await deliverFiscalDocuments({ config,rpc:q.rpc,fetchEmail:async () => Response.json({}, {status:429}) });
  assert.equal(result.emailFailures,1); assert.equal(q.completed[0].p_email_id,null);
});
test('a lost database acknowledgement retries the same document with the same provider key', async () => {
  const keys = []; const fetchEmail = async (_url,options) => { keys.push(options.headers['Idempotency-Key']); return Response.json({id:'email-1'}); };
  await assert.rejects(deliverFiscalDocuments({config,fetchEmail,rpc:async name => { if (name === 'menupro_claim_fiscal_delivery') return document; throw Error('Lost acknowledgement'); }}));
  const q=queue(); await deliverFiscalDocuments({config,fetchEmail,rpc:q.rpc,pause:async () => {}});
  assert.equal(keys.length,2); assert.equal(keys[0],keys[1]);
});
