import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const project = JSON.parse(readFileSync('.insforge/project.json', 'utf8'));
const parent = JSON.parse(readFileSync('.insforge/project.parent.json', 'utf8'));
if (project.project_id === parent.project_id) throw Error('The payment fixture server requires an isolated backend.');
writeFileSync('.insforge/payment-fixture.json', JSON.stringify({ subscriptions: {}, invoices: {}, payments: {} }));
const realProvider = process.argv.includes('--real-provider');
let providerEnv = { NODE_OPTIONS: '--import=./tests/helpers/mercadopago-fixture.mjs' };
if (realProvider) {
  const config = JSON.parse(readFileSync('.insforge/mercadopago-sandbox.local.json', 'utf8'));
  const response = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: 'Bearer ' + config.accessToken }, signal: AbortSignal.timeout(10000) });
  const seller = await response.json();
  if (!response.ok || String(seller.id) !== config.sellerId || !seller.tags?.includes('test_user')) throw Error('Solo se admite una cuenta vendedora de prueba verificada.');
  if (!config.webhookSecret) throw Error('Configura la firma de la aplicación de prueba antes de recibir notificaciones.');
  providerEnv = { NODE_OPTIONS: '', MERCADOPAGO_ACCESS_TOKEN: config.accessToken, MERCADOPAGO_WEBHOOK_SECRET: config.webhookSecret };
}
const child = spawn(process.execPath, [...(realProvider ? [] : ['--import', './tests/helpers/mercadopago-fixture.mjs']), 'node_modules/next/dist/bin/next', 'dev', '--webpack'], {
  stdio: 'inherit', env: { ...process.env, MENUPRO_BILLING_MODE: 'test', MENUPRO_EMAIL_ENABLED: 'false',
    APP_URL: 'https://www.menupro.cl', MERCADOPAGO_WEBHOOK_SECRET: 'isolated-payment-webhook-fixture-only',
    ...providerEnv },
});
child.on('exit', code => process.exit(code ?? 1));
