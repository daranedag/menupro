import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const project = JSON.parse(readFileSync('.insforge/project.json', 'utf8'));
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
  const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)];
}));
if (project.oss_host !== env.NEXT_PUBLIC_INSFORGE_URL) throw new Error('La configuración local y el proyecto vinculado deben coincidir.');
if (!env.MENUPRO_WORKER_SECRET || env.MENUPRO_WORKER_SECRET.length < 40) throw new Error('Configura MENUPRO_WORKER_SECRET antes de preparar el mantenimiento.');
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
// Deploying this worker never enables email or real charges implicitly.
secret('MENUPRO_EMAIL_ENABLED', 'false');
secret('MENUPRO_BILLING_MODE', 'disabled');
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
console.log(JSON.stringify({ backend: project.oss_host, lifecycle: await response.json(), emailEnabled: false, paymentsEnabled: false }));
