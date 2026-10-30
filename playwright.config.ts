import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Integration tests create disposable users. Refuse to run on the shared parent.
let link, parent;
try {
  link = JSON.parse(readFileSync('.insforge/project.json', 'utf8'));
  parent = JSON.parse(readFileSync('.insforge/project.parent.json', 'utf8'));
} catch { throw new Error('Las pruebas de integración requieren una rama aislada de InsForge vinculada.'); }
if (link.project_id === parent.project_id) throw new Error('No ejecutes las pruebas de integración contra DieGui Dev. Vincula una rama aislada.');
const env = readFileSync('.env.local', 'utf8');
if (!env.includes('NEXT_PUBLIC_INSFORGE_URL=' + link.oss_host)) throw new Error('La aplicación debe apuntar a la rama aislada antes de probar.');

export default defineConfig({
  testDir: './tests/integration',
  timeout: 90000,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', headless: true, browserName: 'chromium', channel: 'chrome' },
  reporter: 'list',
});
