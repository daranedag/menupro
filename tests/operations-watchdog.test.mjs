import test from 'node:test';
import assert from 'node:assert/strict';
import { runOperationsWatchdog } from '../src/lib/operations-watchdog.mjs';

const healthy = { monitor: 'menupro-operations-v1', healthy: true, alertsReady: true, failures: 0 };
const pause = async () => {};

test('the external watchdog retries transient outages and reports persistent failures', async () => {
  let probes = 0;
  const recovered = await runOperationsWatchdog({ probe: async () => {
    if (++probes < 3) throw Error('offline');
    return healthy;
  }, pause });
  assert.deepEqual(recovered, { reachable: true, healthy: true, ok: true });
  assert.deepEqual(await runOperationsWatchdog({ probe: async () => { throw Error('offline'); }, pause }),
    { reachable: false, healthy: false, ok: false });
});

test('the watchdog distinguishes incidents in the history from a failed daily email', async () => {
  const incident = await runOperationsWatchdog({ probe: async () => ({ ...healthy, healthy: false }), pause });
  assert.deepEqual(incident, { reachable: true, healthy: false, ok: true });
  const failed = await runOperationsWatchdog({ probe: async () => ({ ...healthy, failures: 1 }), pause });
  assert.deepEqual(failed, { reachable: true, healthy: true, ok: false });
});
