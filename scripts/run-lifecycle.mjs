const secret = process.env.MENUPRO_WORKER_SECRET;
if (!secret || secret.length < 40) throw new Error('Configura MENUPRO_WORKER_SECRET en el entorno del mantenimiento.');
const url = new URL('/api/internal/lifecycle', process.env.APP_URL || 'https://www.menupro.cl');
if (url.protocol !== 'https:') throw new Error('El mantenimiento remoto requiere HTTPS.');
const response = await fetch(url, { method: 'POST', headers: { 'x-menupro-worker-secret': secret }, redirect: 'error', signal: AbortSignal.timeout(65000) });
if (!response.ok) throw new Error('El mantenimiento respondió HTTP ' + response.status);
console.log(JSON.stringify({ maintenance: 'menupro', ok: true }));
