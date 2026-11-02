import { randomUUID } from 'node:crypto';
const descriptions = { site_unreachable: 'La web o la comprobación operativa de MenuPro no responde.', alerts_unavailable: 'El envío de alertas de MenuPro no está configurado correctamente.', alert_delivery_failed: 'MenuPro no pudo enviar sus alertas operativas.' };

/** Independent of the app/backend: the runner holds only a probe token and a
 * domain-restricted Resend sending key. Persist state to avoid repeated alerts. */
export async function runOperationsWatchdog({ probe, notify, previous = {}, now = Date.now, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  let status; let kind = 'site_unreachable';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const value = await probe();
      if (value?.monitor === 'menupro-operations-v1' && typeof value.healthy === 'boolean') {
        status = value;
        kind = !value.alertsReady ? 'alerts_unavailable' : value.failures > 0 ? 'alert_delivery_failed' : null;
        if (!kind) break;
      }
    } catch { /* Retry transient outages; never include raw network errors in email. */ }
    if (attempt < 2) await pause(2000);
  }
  if (kind) {
    const same = previous.kind === kind;
    const incident = same && previous.incident ? previous.incident : previous.incident ? randomUUID() : `initial-${Math.floor(now() / 86400000)}-${kind}`;
    const next = { kind, incident, notified: same && Boolean(previous.notified), checkedAt: new Date(now()).toISOString() };
    if (!next.notified) {
      const result = await notify({ subject: 'MenuPro · Alerta del monitor externo',
        text: descriptions[kind] + '\n\nEl monitor es independiente del mantenimiento de MenuPro. Revisa el estado del despliegue y del backend. Los cobros no se modificaron.',
        idempotencyKey: `menupro-watchdog/${incident}/opened` });
      next.notified = result.emailSent === true;
    }
    return { state: next, ok: next.notified, outage: true };
  }
  if (previous.kind && previous.notified) {
    const result = await notify({ subject: 'MenuPro · Monitor externo recuperado',
      text: 'La comprobación operativa de MenuPro vuelve a responder y puede enviar sus alertas. Los incidentes internos se pueden consultar en administración.',
      idempotencyKey: `menupro-watchdog/${previous.incident}/resolved` });
    if (!result.emailSent) return { state: previous, ok: false, outage: false };
  }
  return { state: { kind: null, incident: previous.incident || null, notified: false, checkedAt: new Date(now()).toISOString() }, ok: true, outage: false, healthy: status.healthy };
}
