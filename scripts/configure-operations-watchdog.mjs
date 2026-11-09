// Auth uses the repository's existing credential helper. Never log its output.
// GitHub receives the monitor token and the private scheduled-worker secret.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import sodium from 'libsodium-wrappers';

const repo = 'daranedag/menupro';
function git(args, input) {
  const result = spawnSync('git', args, { input, encoding: 'utf8', timeout: 30000, env: { ...process.env, GCM_INTERACTIVE: 'never' } });
  if (result.status !== 0) throw Error('No se pudo usar la autenticación existente del repositorio.');
  return result.stdout.trim();
}
if (git(['remote','get-url','origin']) !== `https://github.com/${repo}.git`) throw Error('Repositorio inesperado.');
const credentials = git(['-c','credential.interactive=never','credential','fill'], 'protocol=https\nhost=github.com\n\n');
const token = credentials.match(/^password=(.+)$/m)?.[1];
if (!token) throw Error('No hay una credencial de GitHub disponible.');
async function api(path, method = 'GET', body) {
  if (!path.startsWith(`/repos/${repo}/`) && path !== `/repos/${repo}` && path !== '/repos/actions/checkout/git/ref/tags/v6') throw Error('Destino no permitido.');
  const response = await fetch('https://api.github.com' + path, { method, redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Error(`GitHub ${method} ${path}: HTTP ${response.status}.`);
  return response.status === 204 ? null : response.json();
}
const metadata = await api(`/repos/${repo}`);
const publicKey = await api(`/repos/${repo}/actions/secrets/public-key`);
if (process.argv.includes('--inspect')) {
  const checkout = await api('/repos/actions/checkout/git/ref/tags/v6');
  console.log(JSON.stringify({ repository: metadata.full_name, private: metadata.private, canConfigureSecrets: Boolean(publicKey.key_id), checkoutSha: checkout.object.sha }));
} else {
  const project = JSON.parse(readFileSync('.neon','utf8'));
  if (project.projectId !== 'bitter-heart-68907011' || project.branch !== 'production') throw Error('Configura el monitor contra production de Neon.');
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const i = line.indexOf('='); return [line.slice(0,i),line.slice(i+1)]; }));
  if (!env.DATABASE_URL || env.MENUPRO_WORKER_SECRET?.length < 40) throw Error('Configuración principal incompleta.');
  await sodium.ready;
  const secrets = {
    MENUPRO_MONITOR_TOKEN: createHmac('sha256',env.MENUPRO_WORKER_SECRET).update('menupro/operations-monitor/v1').digest('hex'),
    MENUPRO_WORKER_SECRET: env.MENUPRO_WORKER_SECRET,
  };
  for (const [name,value] of Object.entries(secrets)) {
    const encrypted = sodium.crypto_box_seal(Buffer.from(value),Buffer.from(publicKey.key,'base64'));
    await api(`/repos/${repo}/actions/secrets/${name}`,'PUT',{ key_id: publicKey.key_id, encrypted_value: Buffer.from(encrypted).toString('base64') });
  }
  console.log(JSON.stringify({ repository: repo, configured: Object.keys(secrets) }));
  if (process.argv.includes('--dispatch')) {
    await api(`/repos/${repo}/actions/workflows/menupro-operations.yml/dispatches`,'POST',{ ref: 'main' });
    console.log('Primera comprobación externa solicitada.');
  }
}
