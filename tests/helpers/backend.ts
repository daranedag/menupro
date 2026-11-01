import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@insforge/sdk';
import { expect, request, type APIRequestContext } from '@playwright/test';

const link = JSON.parse(readFileSync('.insforge/project.json', 'utf8'));
const parent = JSON.parse(readFileSync('.insforge/project.parent.json', 'utf8'));
if (link.project_id === parent.project_id) throw new Error('Estas pruebas requieren una rama aislada.');
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
export function query(sql: string) {
  const result = spawnSync(process.execPath, ['node_modules/@insforge/cli/dist/index.js', 'db', 'query', sql, '--json'], { encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) throw new Error(result.stderr || 'Falló la preparación de datos de prueba.');
  return JSON.parse(result.stdout).rows;
}
export async function account(label: string) {
  const context = await request.newContext({ baseURL: 'http://localhost:3000' });
  const email = `menupro-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`;
  const response = await context.post('/api/auth/register', { data: { email, password: 'MenuProTest123!' } });
  expect(response.status(), await response.text()).toBe(200);
  const user = (await response.json()).data.user;
  // The isolated backend skips outgoing verification email but keeps its flag
  // false. This auth fixture represents a verified customer; never run on parent.
  query(`UPDATE auth.users SET email_verified=true WHERE id='${user.id}'`);
  const profile = await context.post('/api/billing/profile', { data: { rut: '11.111.111-1', legalName: 'Receptor de prueba',
    address: 'Domicilio de prueba 123', commune: 'Santiago', email, withholdingParty: 'emitter' } });
  expect(profile.status(), await profile.text()).toBe(200);
  const cookies = (await context.storageState()).cookies;
  const sdk = createClient({ baseUrl: link.oss_host, anonKey: env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    accessToken: cookies.find(cookie => cookie.name === 'insforge_access_token')?.value, isServerMode: true });
  return { context, user, email, sdk };
}
export async function session(context: APIRequestContext) {
  const response = await context.get('/api/auth/session'); expect(response.status(), await response.text()).toBe(200); return (await response.json()).data.user;
}
export async function restaurant(context: APIRequestContext, name: string) {
  const response = await context.post('/api/restaurants', { data: { name } }); expect(response.status(), await response.text()).toBe(201); return (await response.json()).data;
}
export async function startTrial(context: APIRequestContext, item: { id: string; name: string }, overrides = {}) {
  const digits = String(Date.now()).slice(-8);
  return context.post('/api/business/trial', { data: { restaurantId: item.id, name: item.name,
    phone: '+569' + digits, address: 'Dirección ' + digits, city: 'Santiago', unit: '', noPhysicalLocation: false, acceptTerms: true, ...overrides } });
}
export function worker() {
  const sdk = createClient({ baseUrl: link.oss_host, anonKey: env.NEXT_PUBLIC_INSFORGE_ANON_KEY, isServerMode: true });
  return async (fn: string, params: Record<string, unknown>) => {
    const result = await sdk.database.rpc(fn, { p_secret: env.MENUPRO_WORKER_SECRET, ...params });
    expect(result.error, result.error?.message).toBeNull(); return result.data;
  };
}
