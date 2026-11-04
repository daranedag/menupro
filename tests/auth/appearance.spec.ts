import { test, expect, type Page } from '@playwright/test';

test.use({ channel: 'chrome' });

const restaurantTheme = {
  mode: 'light', colorPreset: 'ocean', fontPreset: 'default',
  colors: { primary: '#0891b2', secondary: '#06b6d4', accent: '#0284c7' },
  font: { name: 'Sistema', fontFamily: 'system-ui, -apple-system, sans-serif' },
};

async function panelSession(page: Page, isAdmin = false) {
  // Establish an SSR session using the local fake provider, then supply deterministic UI data.
  await page.request.post('http://127.0.0.1:3101/__test/reset', { data: {} });
  const response = await page.request.post('/api/auth/google', { headers: { Origin: 'http://localhost:3100' } });
  const { data } = await response.json();
  const code = new URL(data.url).searchParams.get('code');
  await page.request.get(`/api/auth/callback?insforge_code=${code}`);
  let savedTheme = structuredClone(restaurantTheme);
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const user = {
      name: 'Equipo MenuPro', email: 'owner@example.invalid', role: isAdmin ? 'platform_admin' : 'restaurant_owner', isAdmin,
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
      '/api/admin/business-choices': [{ id: 'business', name: 'Café del Puerto' }],
      '/api/admin/business-details': { business: { name: 'Café del Puerto', owner_email: 'owner@example.invalid' }, restaurants: [{ name: 'Local Bellavista' }] },
      '/api/admin/records': { rows: url.searchParams.get('kind') === 'businesses' ? [{ id: 'business', name: 'Café del Puerto', plan_id: 'local' }] :
        url.searchParams.get('actor') ? [{ id: 'event', event: 'welcome_terms_changed', actor_email: 'owner@example.invalid',
          created_at: '2026-11-03T19:00:00Z', details: { reason: 'Acuerdo de lanzamiento' } }] : [], hasMore: false },
      '/api/admin/first-month-offer': { payments: 1 },
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
  await expect(page.getByRole('link', { name: 'MenuPro, inicio', exact: true }).first()).toBeVisible();
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

test('business, billing and dashboard use themed surfaces and controls', async ({ page }) => {
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
    ['Inicio', 'Tu carta, al día.'],
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

test('the platform admin lands in the six administrative sections, including from merchant links', async ({ page }) => {
  await panelSession(page, true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/app/dashboard/images');
  await expect(page).toHaveURL(/\/app\/dashboard\/admin$/);
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(navigation.getByRole('link')).toHaveText([
    'Planes disponibles', 'Alertas operativas', 'Solicitudes', 'Transferencias y boletas', 'Negocios registrados', 'Logs',
  ]);
  await expect(page.getByRole('switch', { name: 'Habilitar plan Grupo' })).toBeVisible();
  await navigation.getByRole('link', { name: 'Alertas operativas' }).click();
  await expect(page.getByText(/17:00, hora de Santiago/)).toBeVisible();
  await navigation.getByRole('link', { name: 'Solicitudes' }).click();
  await page.getByLabel('Negocio del descuento').selectOption('business');
  await page.getByLabel('Descuento (%)').fill('25');
  await page.getByLabel('Motivo del descuento').fill('Acuerdo comercial de prueba');
  const offer = page.waitForRequest(request => request.url().endsWith('/api/admin/first-month-offer'));
  await page.getByRole('button', { name: 'Guardar descuento' }).click();
  expect((await offer).postDataJSON()).toMatchObject({ businessId: 'business', percent: 25 });
  await expect(page.getByRole('status').filter({ hasText: 'Descuento guardado' })).toBeVisible();
  await navigation.getByRole('link', { name: 'Transferencias y boletas' }).click();
  await expect(page.getByRole('heading', { name: 'Historial de transferencias' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Boletas de honorarios · emisión manual' })).toBeVisible();
  await navigation.getByRole('link', { name: 'Negocios registrados' }).click();
  await page.locator('summary').getByText('Café del Puerto').click();
  await expect(page.getByText('Local Bellavista')).toBeVisible();
  await navigation.getByRole('link', { name: 'Logs' }).click();
  await page.getByLabel('Usuario').fill('owner@example.invalid');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.locator('summary').getByText('Descuento de bienvenida actualizado').click();
  await expect(page.getByText('Acuerdo de lanzamiento')).toBeVisible();
  await page.screenshot({ path: 'artifacts/ui/admin-logs.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(navigation.getByRole('link')).toHaveCount(6);
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

test('example menu supports keyboard navigation and mobile navigation returns focus', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  const firstTab = page.getByRole('tab', { name: 'Para compartir', exact: true });
  await firstTab.focus();
  await firstTab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'De la cocina', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('Risotto de temporada');
  await page.getByRole('tab', { name: 'De la cocina', exact: true }).press('End');
  await expect(page.getByRole('tabpanel')).toContainText('Limonada de la casa');
  await page.getByRole('tab', { name: 'Para beber', exact: true }).press('Home');
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: 'artifacts/ui/home-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.locator('body *').evaluateAll(elements => elements.filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.right > innerWidth + 1; }).map(element => ({ element: element.tagName, className: element.className, right: element.getBoundingClientRect().right })).slice(0, 12));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify({ width, overflow })).toBe(true);
  }
  const menu = page.locator('button[aria-controls="marketing-mobile-menu"]');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: 'Navegación móvil', exact: true }).getByRole('link', { name: 'Contacto', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/ui/home-mobile.png', fullPage: true });
  await page.goto('/app/login');
  expect(await page.locator('.auth-form-card').evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(await page.locator('.auth-story').evaluate(element => element.getBoundingClientRect().top));
  await page.screenshot({ path: 'artifacts/ui/login-mobile.png', fullPage: true });
});

test('menu editor fits a phone and preview traps focus, closes with Escape and shows restaurant appearance', async ({ page }) => {
  await panelSession(page);
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.route('**/api/menus/restaurant/restaurant', route => route.fulfill({ json: { data: [{ id: 'menu', name: 'Carta de temporada', slug: 'temporada', restaurantId: 'restaurant', isActive: true, sections: [{ id: 'section', name: 'Desde nuestra cocina', isActive: true, items: [{ id: 'dish', name: 'Ñoquis de papa con tomates de temporada', description: 'Hechos en casa con albahaca fresca.', price: 8900, isActive: true }] }] }] } }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/app/dashboard/menus/menu');
  const preview = page.getByRole('button', { name: 'Vista Previa', exact: true });
  await preview.click();
  const dialog = page.getByRole('dialog', { name: 'Vista Previa del Menú', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('$8.900');
  await expect(dialog.locator('.public-menu-header')).toHaveCSS('background-color', 'rgb(8, 145, 178)');
  await dialog.getByRole('button', { name: 'Cerrar ventana' }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(preview).toBeFocused();
  await page.screenshot({ path: 'artifacts/ui/editor-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navegación principal', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await preview.click();
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/ui/menu-preview-mobile.png', fullPage: true });
});
