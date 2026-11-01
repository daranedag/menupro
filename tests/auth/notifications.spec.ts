import { test, expect } from '@playwright/test';

const headers = { 'x-menupro-worker-secret': 'local-notification-test-only-secret-1234567890' };

test('notification dispatch rejects callers without the private worker credential', async ({ request }) => {
  expect((await request.get('/api/internal/notifications')).status()).toBe(401);
  expect((await request.post('/api/internal/notifications')).status()).toBe(401);
  expect((await request.post('/api/internal/notifications', { headers: { 'x-menupro-worker-secret': 'wrong' } })).status()).toBe(401);
});

test('readiness only exposes the provider and configuration state', async ({ request }) => {
  const response = await request.get('/api/internal/notifications', { headers });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ provider: 'resend', ready: true });
});

test('request bodies cannot turn the reminder endpoint into an arbitrary email relay', async ({ request }) => {
  const response = await request.post('/api/internal/notifications', { headers,
    data: { to: 'other@example.invalid', subject: 'Untrusted', html: 'Untrusted' } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ emailed: 0, emailFailures: 0, deferred: 0, emailStatus: 'processed' });
  expect(await response.text()).not.toContain('local-email-test-only');
});
