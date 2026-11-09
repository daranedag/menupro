import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ channel: 'chrome' });

async function setup(page: Page) {
  await page.request.post('http://127.0.0.1:3101/__test/reset', { data: {} });
  const response = await page.request.post('/api/auth/google', { headers: { Origin: 'http://localhost:3100' } });
  const code = new URL((await response.json()).data.url).searchParams.get('code');
  await page.request.get(`/api/auth/callback?insforge_code=${code}`);
  const user = { id: 'user', name: 'Dueña', email: 'owner@example.invalid', businessId: 'business', businessRole: 'owner',
    businesses: [{ id: 'business', name: 'Mi negocio', role: 'owner' }], activeRestaurantId: 'restaurant', canEdit: true,
    restaurants: [{ id: 'restaurant', name: 'Mi restaurante' }],
    subscription: { plan_name: 'Local', has_access: true, effective_status: 'active' } };
  const dish = { id: 'dish', name: 'Sopa de zapallo', description: 'Con semillas tostadas', price: 3500,
    isActive: true, isVisible: true, tags: [] };
  const menu = { id: 'menu', name: 'Carta', sections: [{ id: 'section', name: 'Platos', isActive: true, isVisible: true,
    items: [dish, { ...dish, id: 'other', name: 'Ensalada', isActive: false },
      { ...dish, id: 'hidden', name: 'Plato secreto', isVisible: false }] }] };
  const writes: Record<string, unknown>[] = [];
  let failWrite = false;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/items/dish' && route.request().method() === 'PATCH') {
      const input = route.request().postDataJSON();
      if (failWrite) return route.fulfill({ status: 500, json: { error: 'No se pudo guardar el estado.' } });
      writes.push(input); Object.assign(dish, input);
      return route.fulfill({ json: { data: dish } });
    }
    const fixtures: Record<string, unknown> = {
      '/api/auth/session': { user }, '/api/menus/restaurant/restaurant': [menu],
      '/api/business/notifications': [], '/api/images': { eligible: false }, '/api/business/export-pdf': { ok: true },
    };
    if (path in fixtures) return route.fulfill({ json: { data: fixtures[path] } });
    return route.continue();
  });
  return { writes, failNextWrite: () => { failWrite = true; } };
}

for (const width of [1280, 390]) {
  test(`dish status persists and previews distinguish unavailable, hidden and restored dishes at ${width}px`, async ({ page }) => {
    const { writes } = await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app/dashboard/menus/menu');
    const select = page.getByRole('combobox', { name: 'Estado de Sopa de zapallo' });
    await expect(select).toHaveValue('available');
    await select.selectOption('unavailable');
    await expect(select).toHaveValue('unavailable');
    expect(writes.at(-1)).toEqual({ isActive: false, isVisible: true });
    await page.reload();
    await expect(select).toHaveValue('unavailable');
    await page.getByRole('button', { name: 'Vista Previa', exact: true }).click();
    const preview = page.locator('.public-menu');
    const soup = preview.locator('article').filter({ has: page.getByRole('heading', { name: 'Sopa de zapallo' }) });
    await expect(soup).toHaveClass(/menu-item-unavailable/);
    await expect(soup.getByText('No disponible', { exact: true })).toBeVisible();
    await expect(soup).toContainText('$3.500');
    await expect(preview.getByRole('heading', { name: 'Plato secreto' })).toHaveCount(0);
    await page.screenshot({ path: `artifacts/ui/dish-unavailable-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await select.selectOption('hidden');
    await expect(select).toHaveValue('hidden');
    await page.getByRole('button', { name: 'Vista Previa', exact: true }).click();
    await expect(preview.getByRole('heading', { name: 'Sopa de zapallo' })).toHaveCount(0);
    await expect(preview.getByRole('heading', { name: 'Ensalada' })).toBeVisible();
    await page.keyboard.press('Escape');
    await select.selectOption('available');
    await expect(select).toHaveValue('available');
    await page.getByRole('button', { name: 'Vista Previa', exact: true }).click();
    await expect(soup).not.toHaveClass(/menu-item-unavailable/);
    await expect(soup.getByText('No disponible', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('dish form saves unavailable status and PDF includes the notice while omitting hidden dishes', async ({ page }) => {
  const { writes } = await setup(page);
  await page.goto('/app/dashboard/menus/menu/sections/section/dishes/dish');
  await page.getByRole('combobox', { name: 'Estado del plato', exact: true }).selectOption('unavailable');
  await page.getByRole('button', { name: 'Guardar Cambios', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Estado de Sopa de zapallo' })).toHaveValue('unavailable');
  expect(writes.at(-1)).toMatchObject({ isActive: false, isVisible: true, name: 'Sopa de zapallo', price: 3500 });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
  const path = await (await download).path();
  const pdf = await readFile(path!, 'latin1');
  expect(pdf).toContain('Sopa de zapallo');
  expect(pdf).toContain('No disponible');
  expect(pdf).not.toContain('Plato secreto');
});

test('a failed status save keeps the current state and shows the error', async ({ page }) => {
  const { failNextWrite } = await setup(page);
  await page.goto('/app/dashboard/menus/menu');
  const select = page.getByRole('combobox', { name: 'Estado de Sopa de zapallo' });
  await expect(select).toHaveValue('available');
  failNextWrite();
  await select.selectOption('hidden');
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo guardar' })).toBeVisible();
  await expect(select).toHaveValue('available');
  await expect(select).toBeEnabled();
});

for (const mode of ['light', 'dark']) {
  test(`public menu renders unavailable dishes from the server in ${mode} mode on mobile`, async ({ page }) => {
    const item = { id: 'dish', name: 'Sopa de zapallo', description: 'Con semillas tostadas', price: '3500',
      available: false, visible: true, order_index: 0, image_url: '/dish-fixture.svg', tags: [] };
    await page.request.post('http://127.0.0.1:3101/__test/reset', { data: { publicMenu: {
      restaurant: { name: 'Mi restaurante', theme: { mode, colors: { primary: '#234d3c' }, font: { fontFamily: 'system-ui' } } },
      menu: { name: 'Carta de almuerzo', sections: [{ id: 'section', name: 'Platos', active: true, visible: true, items: [
        item, { ...item, id: 'available', name: 'Ensalada', available: true, image_url: '' },
        { ...item, id: 'hidden', name: 'Plato secreto', visible: false },
      ] }] },
    } } });
    await page.route('**/dish-fixture.svg', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#a65d29"/><circle cx="48" cy="48" r="34" fill="#efb945"/></svg>' }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/menu/mi-local/carta');
    const dish = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Sopa de zapallo' }) });
    await expect(dish.getByText('No disponible', { exact: true })).toBeVisible();
    await expect(dish).toContainText('$3.500');
    await expect(dish.locator('img')).toHaveCSS('filter', 'grayscale(1)');
    await expect(dish.locator('img')).toHaveCSS('opacity', '0.55');
    await expect(page.getByRole('heading', { name: 'Ensalada' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plato secreto' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/ui/public-dish-unavailable-${mode}.png`, fullPage: true });
  });
}
