import { readFileSync, writeFileSync } from 'node:fs';
import { runOperationsWatchdog } from '../src/lib/operations-watchdog.mjs';
import { sendResendEmail } from '../src/lib/resend-email.mjs';
const token = process.env.MENUPRO_MONITOR_TOKEN;
const config = JSON.parse(process.env.MENUPRO_OPERATIONS_RESEND || '{}');
if (!token && !config.apiKey) {
  console.log('Monitor pendiente de activación: todavía no se configuraron sus secretos.');
  process.exit(0);
}
if (!token || !config.apiKey || !config.to || !config.from) throw Error('Faltan los secretos del monitor externo.');
const stateFile = '.menupro-operations-state.json';
let previous = {}; try { previous = JSON.parse(readFileSync(stateFile,'utf8')); } catch { /* First run. */ }
const result = await runOperationsWatchdog({ previous,
  probe: async () => {
    const response = await fetch('https://www.menupro.cl/api/internal/operations', { method: 'POST',
      headers: { 'x-menupro-monitor-secret': token }, redirect: 'error', signal: AbortSignal.timeout(50000) });
    if (!response.ok) throw Error('El servicio no responde.'); return response.json();
  },
  notify: message => sendResendEmail({ ...message, to: config.to, html: '<p>' + message.text.replaceAll('\n','<br>') + '</p>' }, config),
});
writeFileSync(stateFile,JSON.stringify(result.state));
console.log(JSON.stringify({ monitor: 'menupro', reachable: !result.outage, healthy: result.healthy ?? false, notificationAccepted: result.state.notified, ok: result.ok }));
if (!result.ok) process.exitCode = 1;
