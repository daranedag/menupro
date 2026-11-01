import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const project = JSON.parse(readFileSync('.insforge/project.json', 'utf8'));
const enableEmail = process.argv.includes('--enable-email');
const billingMode = process.argv.find(arg => arg.startsWith('--billing-mode='))?.slice('--billing-mode='.length);
if (billingMode && !['disabled', 'test', 'live'].includes(billingMode)) throw new Error('Modo de cobros inválido.');
const appArgument = process.argv.find(arg => arg.startsWith('--app-url='))?.slice('--app-url='.length);
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
  const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)];
}));
if (project.oss_host !== env.NEXT_PUBLIC_INSFORGE_URL) throw new Error('La configuración local y el proyecto vinculado deben coincidir.');
if (!env.MENUPRO_WORKER_SECRET || env.MENUPRO_WORKER_SECRET.length < 40) throw new Error('Configura MENUPRO_WORKER_SECRET antes de preparar el mantenimiento.');
const appUrl = appArgument || env.APP_URL;
if (enableEmail && (!appUrl || new URL(appUrl).protocol !== 'https:')) throw new Error('Indica --app-url=https://tu-dominio antes de habilitar correos.');
if (enableEmail) {
  const readiness = await fetch(new URL('/api/internal/notifications', appUrl), {
    headers: { 'x-menupro-worker-secret': env.MENUPRO_WORKER_SECRET }, redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!readiness.ok || !(await readiness.json()).ready) throw new Error('Despliega y configura Resend en la aplicación antes de habilitar el horario.');
}
if (billingMode && billingMode !== 'disabled') {
  if (!appUrl || new URL(appUrl).protocol !== 'https:') throw new Error('Configura una dirección pública HTTPS antes de habilitar la conciliación.');
  const readiness = await fetch(new URL('/api/internal/payments', appUrl), {
    headers: { 'x-menupro-worker-secret': env.MENUPRO_WORKER_SECRET }, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!readiness.ok) throw new Error('No se pudo comprobar el servicio de pagos.');
  const state = await readiness.json();
  if (!state.ready || state.mode !== billingMode) throw new Error('Primero despliega la aplicación con el mismo modo de cobros y credenciales correspondientes.');
}
function cli(args) {
  const result = spawnSync(process.execPath, ['node_modules/@insforge/cli/dist/index.js', ...args, '--json'], { encoding: 'utf8', timeout: 120000 });
  if (result.status !== 0) throw new Error(result.stderr || 'Falló una operación de InsForge.');
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}
const hash = createHash('sha256').update(env.MENUPRO_WORKER_SECRET).digest('hex');
cli(['db', 'query', `INSERT INTO public.menupro_system_keys(name,secret_hash) VALUES('worker','${hash}') ON CONFLICT(name) DO UPDATE SET secret_hash=excluded.secret_hash`]);
const available = cli(['secrets', 'list']);
const keys = new Set((Array.isArray(available) ? available : available.secrets ?? available.data ?? []).map(secret => secret.key));
function secret(key, value) {
  cli(keys.has(key) ? ['secrets', 'update', key, '--value', value] : ['secrets', 'add', key, value]);
}
secret('MENUPRO_BACKEND_URL', project.oss_host);
secret('MENUPRO_WORKER_SECRET', env.MENUPRO_WORKER_SECRET);
if (appUrl?.startsWith('https://')) secret('MENUPRO_APP_URL', new URL(appUrl).origin);
// Preserve existing activation settings; enabling mail is an explicit option.
if (enableEmail || !keys.has('MENUPRO_EMAIL_ENABLED')) secret('MENUPRO_EMAIL_ENABLED', enableEmail ? 'true' : 'false');
if (billingMode || !keys.has('MENUPRO_BILLING_MODE')) secret('MENUPRO_BILLING_MODE', billingMode || 'disabled');
cli(['functions', 'deploy', 'menupro-lifecycle', '--file', 'functions/menupro-lifecycle.ts', '--name', 'MenuPro lifecycle']);
const jobs = cli(['schedules', 'list']);
const existing = (Array.isArray(jobs) ? jobs : jobs.schedules ?? jobs.data ?? []).find(job => job.name === 'menupro-lifecycle-hourly');
cli(existing ? ['schedules', 'update', String(existing.id), '--cron', '0 * * * *', '--active', 'true',
  '--url', project.oss_host + '/functions/menupro-lifecycle', '--method', 'POST',
  '--headers', JSON.stringify({ 'x-menupro-worker-secret': '${{secrets.MENUPRO_WORKER_SECRET}}' })] : ['schedules', 'create', '--name', 'menupro-lifecycle-hourly', '--cron', '0 * * * *',
  '--url', project.oss_host + '/functions/menupro-lifecycle', '--method', 'POST',
  '--headers', JSON.stringify({ 'x-menupro-worker-secret': '${{secrets.MENUPRO_WORKER_SECRET}}' })]);
const response = await fetch(project.oss_host + '/functions/menupro-lifecycle', { method: 'POST',
  headers: { 'x-menupro-worker-secret': env.MENUPRO_WORKER_SECRET }, signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error('El mantenimiento fue desplegado pero su comprobación devolvió ' + response.status);
console.log(JSON.stringify({ backend: project.oss_host, lifecycle: await response.json(), emailActivationRequested: enableEmail }));
