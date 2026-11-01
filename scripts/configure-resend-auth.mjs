import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const local = parseEnv(readFileSync('.env.local', 'utf8'));
const env = { ...local, ...process.env };
const sender = env.RESEND_FROM?.trim();
const address = sender?.match(/<([^<>]+)>$/)?.[1] || sender;
if (!address || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) throw new Error('Configura RESEND_FROM con una dirección del dominio verificado.');
if (/[\r\n]/.test(sender) || /@(gmail|hotmail|outlook|yahoo)\./i.test(address)) throw new Error('El remitente debe pertenecer a un dominio propio verificado en Resend.');

const configFile = '.insforge/menupro-resend-auth.toml';
writeFileSync(configFile, `[auth.smtp]\nenabled = true\nhost = "smtp.resend.com"\nport = 465\nusername = "resend"\npassword = "env(MENUPRO_RESEND_API_KEY)"\nsender_email = ${JSON.stringify(address)}\nsender_name = "MenuPro"\nmin_interval_seconds = 60\n`);
const apply = process.argv.includes('--apply');
const result = spawnSync(process.execPath, ['node_modules/@insforge/cli/dist/index.js', 'config', apply ? 'apply' : 'plan',
  '--file', configFile, ...(apply ? ['--auto-approve'] : []), '--json'], {
  env, encoding: 'utf8', timeout: 60000,
});
if (result.status !== 0) throw new Error('No se pudo preparar o aplicar SMTP de Resend. Revisa el proyecto vinculado, la conexión y la clave privada.');
const response = JSON.parse(result.stdout);
if (response.skipped?.length) throw new Error('El backend omitió ajustes SMTP: ' + JSON.stringify(response.skipped));
console.log(JSON.stringify({ mode: apply ? 'applied' : 'plan', provider: 'resend', sender: address,
  changedSections: (response.applied || response.changes || []).map(change => change.section),
  sharedBackend: true, note: 'La configuración SMTP es compartida por las aplicaciones de este backend.' }));
