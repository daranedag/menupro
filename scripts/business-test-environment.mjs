import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync('.insforge/project.json', 'utf8'));
const parent = JSON.parse(readFileSync('.insforge/project.parent.json', 'utf8'));
if (config.project_id === parent.project_id) throw new Error('El entorno temporal debe estar vinculado antes de preparar pruebas.');
function cli(args) {
  const result = spawnSync(process.execPath, ['node_modules/@insforge/cli/dist/index.js', ...args, '--json'], { encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) throw new Error('InsForge: ' + (result.stderr || 'La operación falló.'));
  return JSON.parse(result.stdout);
}
const secretResult = cli(['secrets', 'get', 'ANON_KEY']);
const anon = secretResult.value ?? secretResult.secret?.value ?? secretResult.data?.value;
if (typeof anon !== 'string' || anon.length < 50) throw new Error('No fue posible obtener la clave pública del entorno temporal.');
const env = readFileSync('.env.local', 'utf8');
if (!existsSync('.insforge/env-before-business.local')) writeFileSync('.insforge/env-before-business.local', env);
const worker = env.match(/^MENUPRO_WORKER_SECRET=(.+)$/m)?.[1] || randomBytes(48).toString('hex');
const next = env.replace(/^NEXT_PUBLIC_INSFORGE_URL=.*$/m, 'NEXT_PUBLIC_INSFORGE_URL=' + config.oss_host)
  .replace(/^NEXT_PUBLIC_INSFORGE_ANON_KEY=.*$/m, 'NEXT_PUBLIC_INSFORGE_ANON_KEY=' + anon);
writeFileSync('.env.local', next + (next.endsWith('\n') ? '' : '\n') +
  (next.includes('MENUPRO_WORKER_SECRET=') ? '' : 'MENUPRO_WORKER_SECRET=' + worker + '\n') +
  (next.includes('MENUPRO_BILLING_MODE=') ? '' : 'MENUPRO_BILLING_MODE=disabled\n') +
  (next.includes('MENUPRO_EMAIL_ENABLED=') ? '' : 'MENUPRO_EMAIL_ENABLED=false\n'));
const hash = createHash('sha256').update(worker).digest('hex');
cli(['db', 'query', `INSERT INTO public.menupro_system_keys(name,secret_hash) VALUES('worker','${hash}') ON CONFLICT(name) DO UPDATE SET secret_hash=excluded.secret_hash`]);
const auth = readFileSync('.insforge/business-test-auth.toml', 'utf8').replace('require_email_verification = true', 'require_email_verification = false');
writeFileSync('.insforge/business-test-auth.toml', auth);
cli(['config', 'apply', '--file', '.insforge/business-test-auth.toml', '--auto-approve']);
console.log('Entorno de prueba configurado. Correos y cobros deshabilitados. Backend: ' + config.oss_host);
