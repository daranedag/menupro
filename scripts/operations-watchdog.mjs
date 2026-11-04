import { runOperationsWatchdog } from '../src/lib/operations-watchdog.mjs';
const token = process.env.MENUPRO_MONITOR_TOKEN;
if (!token) {
  console.log('Monitor pendiente de activación: todavía no se configuraron sus secretos.');
  process.exit(0);
}
const result = await runOperationsWatchdog({
  probe: async () => {
    const response = await fetch('https://www.menupro.cl/api/internal/operations', { method: 'POST',
      headers: { 'x-menupro-monitor-secret': token }, redirect: 'error', signal: AbortSignal.timeout(50000) });
    if (!response.ok) throw Error('El servicio no responde.'); return response.json();
  },
});
console.log(JSON.stringify({ monitor: 'menupro', ...result }));
if (!result.ok) console.warn('::warning::La comprobación operativa requiere revisión.');
