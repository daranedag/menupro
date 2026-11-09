import { writeFileSync } from 'node:fs';
const name = process.argv[2];
if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error('Uso: pnpm db:new nombre-de-la-migracion');
const timestamp = new Date().toISOString().replace(/\D/g,'').slice(0,14);
const path = 'migrations/neon/' + timestamp + '_menupro-' + name + '.sql';
writeFileSync(path, '-- MenuPro / Neon\n', { flag: 'wx' });
console.log(path);
