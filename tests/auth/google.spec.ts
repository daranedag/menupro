import { test, expect, type APIRequestContext } from '@playwright/test';

const origin = 'http://localhost:3100';
const backend = 'http://127.0.0.1:3101';
const verifierName = 'menupro_google_verifier';

async function start(request: APIRequestContext) {
  const response = await request.post('/api/auth/google', { headers: { Origin: origin } });
  expect(response.status()).toBe(200);
  const { data } = await response.json();
  return { response, data, code: new URL(data.url).searchParams.get('code')! };
}

test.beforeEach(async ({ request }) => {
  await request.post(`${backend}/__test/reset`, { data: {} });
});

test('Google initiation keeps PKCE private and rejects cross-origin requests', async ({ request }) => {
  const blocked = await request.post('/api/auth/google', { headers: { Origin: 'https://other.example', 'Sec-Fetch-Site': 'cross-site' } });
  expect(blocked.status()).toBe(403);
  const { response, data } = await start(request);
  expect(Object.keys(data)).toEqual(['url']);
  expect(new URL(data.url).searchParams.get('redirect_uri')).toBe(`${origin}/api/auth/callback`);
  expect(response.headers()['cache-control']).toBe('no-store');
  const verifier = (await request.storageState()).cookies.find(cookie => cookie.name === verifierName)!;
  expect(verifier.httpOnly).toBe(true);
  expect(verifier.sameSite).toBe('Lax');
  expect(verifier.path).toBe('/api/auth');
  expect(verifier.expires - Date.now() / 1000).toBeGreaterThan(500);
  expect(JSON.stringify(data)).not.toContain(verifier.value);
});

test('a bound OAuth code establishes the SSR session and creates the Google profile', async ({ request }) => {
  const { code } = await start(request);
  const response = await request.get(`/api/auth/callback?insforge_code=${code}&next=https://other.example`, { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe(`${origin}/app/dashboard`);
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
  const cookies = (await request.storageState()).cookies;
  expect(cookies.find(cookie => cookie.name === verifierName)).toBeUndefined();
  expect(cookies.find(cookie => cookie.name === 'insforge_refresh_token')?.httpOnly).toBe(true);
  expect(cookies.find(cookie => cookie.name === 'insforge_access_token')).toBeTruthy();
  const session = await request.get('/api/auth/session');
  expect(session.status()).toBe(200);
  const { data } = await session.json();
  expect(data.user.name).toBe('Nombre de Google');
  expect(data.user.restaurants).toEqual([]);
  expect(JSON.stringify(data)).not.toMatch(/accessToken|refreshToken|csrfToken/);
  const again = await request.get('/api/auth/session');
  expect((await again.json()).data.user.id).toBe(data.user.id);
});

test('callbacks without the initiating cookie cannot exchange a code', async ({ request }) => {
  const response = await request.get('/api/auth/callback?insforge_code=unbound', { maxRedirects: 0 });
  expect(response.headers().location).toBe(`${origin}/app/login?error=google_session_expired`);
  const state = await request.get(`${backend}/__test/state`);
  expect((await state.json()).exchangeCalls).toBe(0);
});

test('cancellation clears the verifier and returns a friendly login error', async ({ request }) => {
  await start(request);
  const response = await request.get('/api/auth/callback?error=access_denied', { maxRedirects: 0 });
  expect(response.headers().location).toBe(`${origin}/app/login?error=google_cancelled`);
  expect((await request.storageState()).cookies.find(cookie => cookie.name === verifierName)).toBeUndefined();
});

test('an invalid code clears the verifier without establishing a session', async ({ request }) => {
  await start(request);
  const response = await request.get('/api/auth/callback?insforge_code=invalid', { maxRedirects: 0 });
  expect(response.headers().location).toBe(`${origin}/app/login?error=google_failed`);
  expect((await request.storageState()).cookies.filter(cookie => cookie.name.startsWith('insforge_') || cookie.name === verifierName)).toEqual([]);
});

test('duplicate authorization codes are rejected before exchange', async ({ request }) => {
  const { code } = await start(request);
  const response = await request.get(`/api/auth/callback?insforge_code=${code}&insforge_code=other`, { maxRedirects: 0 });
  expect(response.headers().location).toBe(`${origin}/app/login?error=google_failed`);
  const state = await request.get(`${backend}/__test/state`);
  expect((await state.json()).exchangeCalls).toBe(0);
});

test('provider outages return a recoverable error without leaking credentials', async ({ request }) => {
  await request.post(`${backend}/__test/reset`, { data: { initFailure: true } });
  const response = await request.post('/api/auth/google', { headers: { Origin: origin } });
  expect(response.status()).toBe(503);
  expect((await response.json()).error).toContain('Google');
  expect((await request.storageState()).cookies.find(cookie => cookie.name === verifierName)).toBeUndefined();
});
