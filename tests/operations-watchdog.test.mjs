import test from 'node:test';
import assert from 'node:assert/strict';
import { runOperationsWatchdog } from '../src/lib/operations-watchdog.mjs';
const healthy = { monitor:'menupro-operations-v1',healthy:true,alertsReady:true,failures:0 };
const pause = async () => {};
test('external outages send one alert and one recovery, remaining quiet while unchanged', async () => {
  const messages=[]; const notify=async message => { messages.push(message); return {emailSent:true}; };
  const down=async () => { throw Error('offline'); };
  const first=await runOperationsWatchdog({probe:down,notify,pause});
  const second=await runOperationsWatchdog({probe:down,notify,pause,previous:first.state});
  assert.equal(messages.length,1); assert.equal(second.outage,true);
  const recovered=await runOperationsWatchdog({probe:async () => healthy,notify,pause,previous:second.state});
  await runOperationsWatchdog({probe:async () => healthy,notify,pause,previous:recovered.state});
  assert.equal(messages.length,2); assert.match(messages[1].subject,/recuperado/);
});
test('internal incidents rely on the durable app queue and do not duplicate alerts externally', async () => {
  const result=await runOperationsWatchdog({probe:async () => ({...healthy,healthy:false,codes:['payment_recovery']}),notify:async () => assert.fail('Duplicate alert'),pause});
  assert.equal(result.ok,true); assert.equal(result.healthy,false); assert.equal(result.outage,false);
});
test('transient timeouts recover before warning and a rejected warning is retried', async () => {
  let probes=0;
  await runOperationsWatchdog({probe:async () => { if (++probes<3) throw Error('transient'); return healthy; },notify:async () => assert.fail('Transient alert'),pause});
  const first=await runOperationsWatchdog({probe:async () => {throw Error('offline');},notify:async () => ({emailSent:false}),pause});
  assert.equal(first.ok,false);
  const keys=[]; const second=await runOperationsWatchdog({previous:first.state,probe:async () => {throw Error('offline');},notify:async value => {keys.push(value.idempotencyKey);return {emailSent:true};},pause});
  assert.equal(second.ok,true); assert.equal(keys[0],`menupro-watchdog/${first.state.incident}/opened`);
});
