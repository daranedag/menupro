import { test, expect } from '@playwright/test';
test.beforeEach(async ({ request }) => { await request.post('http://127.0.0.1:3101/__test/reset', { data: {} }); });

test('password recovery requires a code, keeps the reset token HttpOnly and clears it on success', async ({ request }) => {
  const email = 'recovery@example.invalid';
  let result = await request.post('/api/auth/password/confirm', { data: { password: 'NewPassword123!' } }); expect(result.status()).toBe(401);
  result = await request.post('/api/auth/password/request', { data: { email } }); expect(result.status()).toBe(200);
  expect(await result.text()).toContain('Si existe una cuenta');
  result = await request.post('/api/auth/password/verify', { data: { email, code: '000000' } }); expect(result.status()).toBe(400);
  result = await request.post('/api/auth/password/verify', { data: { email, code: '123456' } }); expect(result.status()).toBe(200);
  expect(await result.text()).not.toContain('local-password-reset-token');
  const cookie = (await request.storageState()).cookies.find(cookie => cookie.name === 'menupro_password_reset');
  expect(cookie?.httpOnly).toBe(true); expect(cookie?.path).toBe('/api/auth/password');
  result = await request.post('/api/auth/password/confirm', { data: { password: 'NewPassword123!' } }); expect(result.status()).toBe(200);
  expect((await request.storageState()).cookies.find(cookie => cookie.name === 'menupro_password_reset')).toBeUndefined();
  expect((await (await request.get('http://127.0.0.1:3101/__test/state')).json()).passwordChanged).toBe(true);
});
test('password recovery rejects requests from another origin', async ({ request }) => {
  const result = await request.post('/api/auth/password/request', { headers: { Origin: 'https://other.example', 'Sec-Fetch-Site': 'cross-site' }, data: { email: 'recovery@example.invalid' } });
  expect(result.status()).toBe(403);
});
