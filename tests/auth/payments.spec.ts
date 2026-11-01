import { test, expect } from '@playwright/test';
test('payment recovery rejects public calls and does not process arbitrary request bodies', async ({ request }) => {
  expect((await request.post('/api/internal/payments')).status()).toBe(401);
  expect((await request.post('/api/internal/payments', { headers: { 'x-menupro-worker-secret': 'wrong' } })).status()).toBe(401);
  const response = await request.post('/api/internal/payments', { headers: { 'x-menupro-worker-secret': 'local-notification-test-only-secret-1234567890' },
    data: { paymentId: 'untrusted-payment', status: 'approved', amount: 9990 } });
  expect(response.status()).toBe(200); expect(await response.json()).toEqual({ checked: 0, recovered: 0, failures: 0, disabled: true });
});
