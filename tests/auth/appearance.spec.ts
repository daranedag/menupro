import { test, expect, type Page } from '@playwright/test';

test.use({ channel: 'chrome' });

const restaurantTheme = {
  mode: 'light', colorPreset: 'ocean', fontPreset: 'default',
  colors: { primary: '#0891b2', secondary: '#06b6d4', accent: '#0284c7' },
  font: { name: 'Sistema', fontFamily: 'system-ui, -apple-system, sans-serif' },
};

async function panelSession(page: Page) {
  // Establish an SSR session using the local fake provider, then supply deterministic UI data.
  await page.request.post('http://127.0.0.1:3101/__test/reset', { data: {} });
  const response = await page.request.post('/api/auth/google', { headers: { Origin: 'http://localhost:3100' } });
  const { data } = await response.json();
  const code = new URL(data.url).searchParams.get('code');
  await page.request.get(`/api/auth/callback?insforge_code=${code}`);
  let savedTheme = structuredClone(restaurantTheme);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const user = {
      name: 'Equipo MenuPro', email: 'owner@example.invalid', role: 'platform_admin', isAdmin: true,
      businessId: 'business', businessRole: 'owner', activeRestaurantId: 'restaurant', canEdit: true,
      businesses: [{ id: 'business', name: 'Mi negocio', role: 'owner' }],
      restaurants: [{ id: 'restaurant', name: 'Mi restaurante', theme: savedTheme }],
      subscription: { plan_id: 'local', plan_name: 'Local', has_access: true, effective_status: 'active' },
    };
    if (path === '/api/restaurants/restaurant' && route.request().method() === 'PATCH') {
      savedTheme = route.request().postDataJSON().theme;
      return route.fulfill({ json: { data: {} } });
    }
    const fixtures: Record<string, unknown> = {
      '/api/auth/session': { user },
      '/api/menus/restaurant/restaurant': [],
      '/api/business/team': { members: [], invitations: [] },
      '/api/business/notifications': [],
      '/api/billing': { plans: [], payments: [], documents: [], checkouts: [], availability: {} },
      '/api/billing/quote': { gross_amount: 10000, honorarium_gross: 10000, withholding_amount: 0, retention_rate: 0, starts_at: '2026-11-02' },
      '/api/admin/overview': { businesses: [], claims: [], events: [] },
      '/api/admin/commercial': { grupo_enabled: false, annual_enabled: false },
      '/api/admin/operations': { incidents: [], alerts: [] },
      '/api/admin/fiscal': { documents: [], total: 0 },
    };
    if (path in fixtures) return route.fulfill({ json: { data: fixtures[path] } });
    return route.continue();
  });
}

async function background(page: Page, selector: string) {
  return page.locator(selector).first().evaluate(element => getComputedStyle(element).backgroundColor);
}

test('landing and login share the saved theme across navigation and reloads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('header a[href="/"] img')).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar a modo oscuro', exact: true }).click();
  await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).first().click();
  await expect(page.getByText('Utilizamos las apps de InsForge e InstaCloud')).toBeVisible();
  await expect.poll(() => background(page, '.bg-surface')).toBe('rgb(15, 18, 17)');
  await expect(page.getByLabel(/^Email/)).toHaveCSS('color', 'rgb(229, 231, 235)');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Cambiar a modo claro', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/ui/login-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Cambiar a modo claro', exact: true }).click();
  await expect.poll(() => background(page, '.bg-surface')).toBe('rgb(255, 255, 255)');
  await expect(page.getByLabel(/^Email/)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('button', { name: 'Continuar con Google', exact: true })).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: 'artifacts/ui/login-light.png', fullPage: true });
  await page.getByRole('link', { name: '← Volver a MenuPro' }).click();
  await expect(page.getByRole('button', { name: 'Cambiar a modo oscuro', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('business, billing, admin and dashboard use themed surfaces and controls', async ({ page }) => {
  await panelSession(page);
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let finishLoading!: () => void;
  const pendingMenus = new Promise<void>(resolve => { finishLoading = resolve; });
  await page.route('**/api/menus/restaurant/restaurant', async route => {
    await pendingMenus;
    await route.fulfill({ json: { data: [] } });
  });
  await page.goto('/app/dashboard');
  await expect(page.getByRole('status')).toContainText('Cargando cartas…');
  await expect(page.locator('.animate-spin')).toHaveCSS('animation-name', 'spin');
  await expect.poll(() => background(page, '.bg-surface')).toBe('rgb(15, 18, 17)');
  finishLoading();
  for (const [label, heading] of [
    ['Mi negocio', 'Mi negocio y equipo'], ['Suscripción', 'Suscripción y pagos'],
    ['Admin', 'Administración de MenuPro'], ['Dashboard', 'Bienvenido, Equipo MenuPro'],
  ]) {
    await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect.poll(() => background(page, 'header')).toBe('rgb(15, 18, 17)');
    const surfaces = await page.locator('main .bg-surface').evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundColor));
    expect(surfaces.length).toBeGreaterThan(0);
    expect(surfaces.every(color => color === 'rgb(15, 18, 17)')).toBe(true);
    await expect(page.locator('main')).toHaveCSS('color', 'rgb(229, 231, 235)');
  }
  await page.screenshot({ path: 'artifacts/ui/dashboard-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Cambiar a modo claro', exact: true }).click();
  await expect.poll(() => background(page, 'header')).toBe('rgb(255, 255, 255)');
  expect(errors).toEqual([]);
});

test('restaurant palette and fonts stay local and saving preserves the restaurant mode', async ({ page }) => {
  await panelSession(page);
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/app/dashboard/settings');
  await expect(page.getByRole('button', { name: 'ocean' })).toHaveAttribute('aria-pressed', 'true');
  const headerBefore = await background(page, 'header');
  const canvasBefore = await background(page, 'main');
  const appFont = await page.locator('main').evaluate(element => getComputedStyle(element).fontFamily);
  await page.getByRole('button', { name: 'royal', exact: true }).click();
  await page.getByRole('button', { name: /Classic/ }).click();
  expect(await background(page, 'header')).toBe(headerBefore);
  expect(await background(page, 'main')).toBe(canvasBefore);
  expect(await page.locator('main').evaluate(element => getComputedStyle(element).fontFamily)).toBe(appFont);
  await expect(page.getByRole('heading', { name: 'Nombre del Restaurante' })).toHaveCSS('color', 'rgb(124, 58, 237)');
  const saveRequest = page.waitForRequest(request => request.method() === 'PATCH' && request.url().endsWith('/api/restaurants/restaurant'));
  await page.getByRole('button', { name: 'Guardar apariencia del restaurante' }).click();
  expect((await saveRequest).postDataJSON().theme).toMatchObject({ mode: 'light', colorPreset: 'royal', fontPreset: 'classic' });
  await expect(page.getByRole('status')).toContainText('Apariencia guardada');
  const fontGrid = page.getByRole('heading', { name: 'Tipografía', exact: true }).locator('../..').locator('.grid');
  expect((await fontGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns)).split(' ')).toHaveLength(3);
  await page.screenshot({ path: 'artifacts/ui/settings-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await fontGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns)).split(' ')).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Restaurar Valores Predeterminados' }).click();
  await expect(page.getByRole('button', { name: 'Cambiar a modo claro', exact: true })).toBeVisible();
  await expect.poll(() => background(page, 'header')).toBe(headerBefore);
  await page.screenshot({ path: 'artifacts/ui/settings-mobile-dark.png', fullPage: true });
});
