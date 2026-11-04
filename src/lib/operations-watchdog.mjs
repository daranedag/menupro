/** Retry the independent probe and leave email delivery to the daily digest. */
export async function runOperationsWatchdog({ probe, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const value = await probe();
      if (value?.monitor === 'menupro-operations-v1' && typeof value.healthy === 'boolean') {
        return { reachable: true, healthy: value.healthy, ok: Boolean(value.alertsReady && !value.failures) };
      }
    } catch { /* Retry transient outages without reporting raw network errors. */ }
    if (attempt < 2) await pause(2000);
  }
  return { reachable: false, healthy: false, ok: false };
}
