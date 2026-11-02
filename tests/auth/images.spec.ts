import { test, expect, type Page } from '@playwright/test';

test.use({ channel: 'chrome' });
async function setup(page: Page, eligible = true) {
  await page.request.post('http://127.0.0.1:3101/__test/reset', { data: {} });
  const response = await page.request.post('/api/auth/google', { headers: { Origin: 'http://localhost:3100' } });
  const code = new URL((await response.json()).data.url).searchParams.get('code');
  await page.request.get(`/api/auth/callback?insforge_code=${code}`);
  let source: any = null;
  const saved: any[] = [];
  const user = { id: 'user', name: 'Dueño', email: 'owner@example.invalid', businessId: 'business', businessRole: 'owner',
    businesses: [{ id: 'business', name: 'Mi negocio', role: 'owner' }], activeRestaurantId: 'restaurant', canEdit: true,
    restaurants: [{ id: 'restaurant', name: 'Mi restaurante' }], subscription: { plan_name: 'Local', has_access: true, effective_status: eligible ? 'active' : 'trial' } };
  const dish = { id: 'dish', name: 'Pizza', price: 7000, image: '', tags: [] };
  const menu = { id: 'menu', name: 'Carta', sections: [{ id: 'section', name: 'Platos', items: [dish] }] };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/images/source') {
      if (route.request().method() === 'DELETE') source = null;
      else { const input = route.request().postDataJSON(); saved.push(input); source = { id: 'source', name: input.name, provider: input.provider, base_url: input.baseUrl, folder: input.folder }; }
      return route.fulfill({ json: { data: source } });
    }
    if (path === '/api/images/assets') { const input = route.request().postDataJSON(); return route.fulfill({ json: { data: { id: '29fd5acd-7873-41b5-bb6b-8a4c0b6d0d81', url: input.url, name: input.name } } }); }
    const fixtures: Record<string, unknown> = {
      '/api/auth/session': { user }, '/api/menus/restaurant/restaurant': [menu],
      '/api/images': { eligible, canManage: eligible, source, imagekitReady: true },
      '/api/images/catalog': { images: [{ name: 'Pizza de la casa', url: 'https://ik.imagekit.io/local/pizza.jpg' }], nextOffset: null },
      '/api/business/notifications': [],
    };
    if (path in fixtures) return route.fulfill({ json: { data: fixtures[path] } });
    return route.continue();
  });
  return { saved };
}

test('ImageKit connection is optional, saves without retaining the key in the form, and disconnects explicitly', async ({ page }) => {
  const { saved } = await setup(page);
  await page.goto('/app/dashboard/images');
  await expect(page.getByText('Tus cartas pueden funcionar solo con texto.')).toBeVisible();
  await page.getByLabel('Dirección pública del servidor').fill('https://ik.imagekit.io/local');
  await page.getByLabel('Clave privada de ImageKit').fill('private_fixture');
  await page.getByRole('button', { name: 'Guardar conexión', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Servidor conectado');
  await expect(page.getByLabel('Clave privada de ImageKit')).toHaveValue('');
  expect(saved[0].provider).toBe('imagekit');
  await page.screenshot({ path: 'artifacts/ui/imagekit-connection.png', fullPage: true });
  await page.getByRole('button', { name: 'Desconectar servidor', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirmar desconexión' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar desconexión' }).click();
  await expect(page.getByRole('status')).toContainText('Servidor desconectado');
});

test('trial accounts see the optional paid feature without a required connection form', async ({ page }) => {
  await setup(page, false);
  await page.goto('/app/dashboard/images');
  await expect(page.getByText('Esta opción requiere una suscripción pagada vigente.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar conexión' })).toHaveCount(0);
  await page.goto('/app/dashboard/menus/menu/sections/section/dishes/dish');
  await expect(page.getByLabel('Nombre del Plato')).toHaveValue('Pizza');
  await expect(page.getByLabel('URL de Imagen (Opcional)')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Guardar Cambios', exact: true })).toBeEnabled();
});

test('paid owner selects an ImageKit image in the dish editor and can remove it on mobile', async ({ page }) => {
  await setup(page);
  await page.route('**/api/images', route => route.fulfill({ json: { data: { eligible: true, canManage: true, source: { name: 'Mi biblioteca', provider: 'imagekit', base_url: 'https://ik.imagekit.io/local' } } } }));
  await page.route('https://ik.imagekit.io/local/pizza.jpg', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><rect width="400" height="250" fill="#234D3C"/></svg>' }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/dashboard/menus/menu/sections/section/dishes/dish');
  await page.getByRole('button', { name: 'Explorar ImageKit', exact: true }).click();
  await page.getByRole('button', { name: 'Pizza de la casa Elegir imagen' }).click();
  await expect(page.getByLabel('URL de Imagen (Opcional)')).toHaveValue('https://ik.imagekit.io/local/pizza.jpg');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/ui/imagekit-dish-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Quitar imagen', exact: true }).click();
  await expect(page.getByLabel('URL de Imagen (Opcional)')).toHaveValue('');
});
