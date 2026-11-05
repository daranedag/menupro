import { test, expect, type Page } from '@playwright/test';

test.use({ channel: 'chrome' });

async function setup(page: Page, status = 'trial', empty = false) {
  await page.request.post('http://127.0.0.1:3101/__test/reset', { data: {} });
  const response = await page.request.post('/api/auth/google', { headers: { Origin: 'http://localhost:3100' } });
  const code = new URL((await response.json()).data.url).searchParams.get('code');
  await page.request.get(`/api/auth/callback?insforge_code=${code}`);
  const user = {
    id: 'tour-user', name: 'Dueña', email: 'owner@example.invalid', businessId: 'business', businessRole: 'owner',
    businesses: [{ id: 'business', name: 'Mi negocio', role: 'owner' }], activeRestaurantId: 'restaurant',
    activeRestaurantSlug: 'mi-local', canEdit: status !== 'unstarted',
    restaurants: [{ id: 'restaurant', name: 'Mi restaurante', phone: '+56912345678', address: 'Calle 123', city: 'Santiago' }],
    subscription: { plan_id: 'local', plan_name: 'Local', max_restaurants: 1, has_access: status !== 'unstarted',
      effective_status: status, trial_ends_at: new Date(Date.now() + 15 * 86400000).toISOString() },
  };
  const menu = { id: 'menu', name: 'Carta de ejemplo', slug: 'carta', isActive: true, isVisible: true, isPublished: false,
    sections: [{ id: 'section', name: 'Bebidas', isActive: true,
      items: [{ id: 'dish', name: 'Limonada', price: 3500, isActive: true, tags: [] }] }] };
  const writes: string[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') writes.push(path);
    if (path === '/api/business/trial') {
      user.subscription.effective_status = 'trial'; user.subscription.has_access = true; user.canEdit = true;
      return route.fulfill({ json: { data: { ok: true } } });
    }
    if (path === '/api/auth/session') return route.fulfill({ json: { data: { user } } });
    if (path === '/api/menus/restaurant/restaurant') return route.fulfill({ json: { data: empty ? [] : [menu] } });
    if (path === '/api/business/notifications') return route.fulfill({ json: { data: [] } });
    return route.continue();
  });
  return { user, writes };
}

const title = (page: Page) => page.locator('.driver-popover-title');

test('activating a demo opens the home tour once, supports back, skip, replay and manual download', async ({ page }) => {
  const { writes } = await setup(page, 'unstarted');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/app/dashboard');
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  await page.getByRole('checkbox', { name: /Acepto los/ }).check();
  await page.getByRole('button', { name: 'Activar demo gratis', exact: true }).click();
  await expect(title(page)).toHaveText('Tu demo ya está lista');
  await expect(page.locator('.driver-popover-progress-text')).toHaveText('1 de 6');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(title(page)).toHaveText('Empieza por tu carta');
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(title(page)).toHaveText('Tu demo ya está lista');
  await expect(page.locator('.driver-popover')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'artifacts/ui/tour-home-desktop.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver recorrido guiado' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ver recorrido guiado' })).toBeEnabled();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver recorrido guiado' }).click();
  await expect(title(page)).toHaveText('Tu demo ya está lista');
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(title(page)).toHaveText('Tu ayuda, siempre a mano');
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Manual de usuario (PDF)' }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('menupro-guia-rapida.pdf');
  expect(writes).toEqual(['/api/business/trial']);
  expect(errors).toEqual([]);
});

test('mobile editor tour highlights real controls, finishes without editing or publishing and stays dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  const { writes } = await setup(page);
  await page.goto('/app/dashboard/menus/menu');
  for (const expected of ['Organiza tu carta', 'Edita platos y precios', 'Revisa antes de compartir', 'Comparte con QR o PDF', 'El último paso: publicar']) {
    await expect(title(page)).toHaveText(expected);
    const bounds = await page.locator('.driver-popover').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    if (expected === 'Comparte con QR o PDF') await page.screenshot({ path: 'artifacts/ui/tour-editor-mobile.png', fullPage: true });
    await page.getByRole('button', { name: expected === 'El último paso: publicar' ? 'Terminar' : 'Siguiente', exact: true }).click();
  }
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ver recorrido guiado' })).toBeEnabled();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('tour storage is isolated by user and business, while active subscriptions only launch on request', async ({ page }) => {
  const { user } = await setup(page, 'active');
  await page.goto('/app/dashboard');
  await expect(page.getByRole('button', { name: 'Ver recorrido guiado' })).toBeEnabled();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  user.subscription.effective_status = 'trial';
  await page.reload();
  await expect(title(page)).toHaveText('Tu demo ya está lista');
  await page.getByRole('button', { name: 'Cerrar recorrido' }).click();
  user.id = 'other-user';
  await page.reload();
  await expect(title(page)).toHaveText('Tu demo ya está lista');
  await page.keyboard.press('Escape');
  user.businessId = 'other-business';
  await page.reload();
  await expect(title(page)).toHaveText('Tu demo ya está lista');
});

test('empty menus and unavailable storage still allow the tour without blocking the panel', async ({ page }) => {
  await setup(page, 'trial', true);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage disabled'); };
    Storage.prototype.setItem = () => { throw new Error('Storage disabled'); };
  });
  await page.goto('/app/dashboard');
  await expect(title(page)).toHaveText('Tu demo ya está lista');
  await page.keyboard.press('Escape');
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver recorrido guiado' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Crear mi primera carta Organiza secciones, platos y precios.' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver recorrido guiado' }).click();
  await expect(title(page)).toHaveText('Tu demo ya está lista');
});

test('trial loading and failed menu requests do not launch a tour over incomplete content', async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/menus/restaurant/restaurant', async route => {
    await pending;
    return route.fulfill({ status: 503, json: { error: 'No se pudieron cargar las cartas.' } });
  });
  await page.goto('/app/dashboard');
  await expect(page.getByRole('button', { name: 'Ver recorrido guiado' })).toBeDisabled();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  release();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver recorrido guiado' })).toBeDisabled();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  const manual = await page.request.get('/manuales/menupro-guia-rapida.pdf');
  expect(manual.status()).toBe(200);
  expect(manual.headers()['content-type']).toContain('application/pdf');
  expect((await manual.body()).subarray(0, 5).toString()).toBe('%PDF-');
});
