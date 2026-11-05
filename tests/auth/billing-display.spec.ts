import { test, expect, type Page } from '@playwright/test';

test.use({ channel: 'chrome' });

async function setup(page: Page, paid = false, admin = false) {
  await page.request.post('http://127.0.0.1:3101/__test/reset', { data: {} });
  const response = await page.request.post('/api/auth/google', { headers: { Origin: 'http://localhost:3100' } });
  const code = new URL((await response.json()).data.url).searchParams.get('code');
  await page.request.get(`/api/auth/callback?insforge_code=${code}`);
  const subscription = { plan_id: 'local', plan_name: 'Local', provider_subscription_id: 'mp-current',
    provider_status: 'authorized', effective_status: paid ? 'active' : 'trial', has_access: true,
    trial_ends_at: '2026-11-17T19:15:05Z', current_period_end: paid ? '2099-12-17T19:15:05Z' : null };
  const checkout = { id: 'current', purpose: 'subscription', plan_id: 'local', cycle: 'monthly',
    status: paid ? 'paid' : 'authorized', starts_at: '2099-11-17T19:15:05Z', gross_amount: 999,
    provider_id: 'mp-current', checkout_url: 'https://www.mercadopago.cl/current' };
  const profile = { rut: '111111111', legal_name: 'Mi negocio', address: 'Calle 123', commune: 'Santiago',
    email: 'owner@example.invalid', withholding_party: 'emitter' };
  const user = { id: 'billing-user', name: 'Dueña', email: profile.email, businessId: 'business', businessRole: 'owner',
    businesses: [{ id: 'business', name: 'Mi negocio', role: 'owner' }], restaurants: [], subscription, isAdmin: admin };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let data;
    if (path === '/api/auth/session') data = { user };
    else if (path === '/api/business/notifications') data = [];
    else if (path === '/api/admin/records') data = { rows: [{ id: 'business', name: 'Mi negocio', owner_email: profile.email,
      plan_id: 'local', status: subscription.effective_status, has_access: true, subscription }], hasMore: false };
    else if (path === '/api/admin/business-details') data = { business: { name: 'Mi negocio' }, subscription, subscriptionCheckout: checkout };
    else if (path === '/api/billing') data = { subscription, subscriptionCheckout: checkout, profile, payments: [], documents: [],
      plans: [{ id: 'local', name: 'Local', monthly_net: 9990, annual_net: 99900, max_restaurants: 1 }],
      checkouts: [checkout, { ...checkout, id: 'cancelled', status: 'cancelled' }, { ...checkout, id: 'draft', status: 'ready', provider_id: 'mp-draft' }],
      configuration: { ready: true }, availability: {} };
    else if (path === '/api/billing/quote') data = { gross_amount: 999, starts_at: checkout.starts_at };
    else return route.continue();
    return route.fulfill({ json: { data } });
  });
}

test('authorized subscription comes first, separates demo from charge and hides completed checkout links', async ({ page }) => {
  await setup(page);
  await page.goto('/app/dashboard/billing');
  const summary = page.getByRole('region', { name: 'Tu suscripción' });
  await expect(summary).toContainText('Suscripción autorizada');
  await expect(summary).toContainText('Primer cobro programado');
  await expect(summary).toContainText('$999');
  await expect(summary).toContainText('Demo activa');
  await expect(page.getByRole('heading', { name: /Contratación pendiente/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Continuar contratación' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Datos para la boleta de honorarios' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Revisar y editar datos de boleta' }).click();
  await expect(page.getByLabel('Nombre completo o razón social')).toHaveValue('Mi negocio');
  await expect(page.getByRole('button', { name: 'Guardar datos tributarios' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/ui/subscription-authorized-desktop.png', fullPage: true });
});

test('administrator sees authorization in the directory and the scheduled first charge in details', async ({ page }) => {
  await setup(page, false, true);
  await page.goto('/app/dashboard/admin/negocios');
  const business = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Mi negocio' }) });
  await expect(business.locator('summary')).toContainText('Suscripción autorizada');
  await business.locator('summary').click();
  const summary = page.getByRole('region', { name: 'Tu suscripción' });
  await expect(summary).toContainText('Primer cobro programado');
  await expect(summary).toContainText('$999');
  await expect(summary).toContainText('Demo activa');
  await page.screenshot({ path: 'artifacts/ui/subscription-admin-desktop.png', fullPage: true });
});

test('paid subscription shows paid period ahead of plan selection on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, true);
  await page.goto('/app/dashboard/billing');
  const summary = page.getByRole('region', { name: 'Tu suscripción' });
  await expect(summary).toContainText('Suscripción activa');
  await expect(summary).toContainText('Período pagado hasta');
  await expect(summary).not.toContainText('Primer cobro programado');
  await expect(page.getByRole('heading', { name: 'Continuar con MenuPro' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/ui/subscription-paid-mobile.png', fullPage: true });
});
