import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
const local = parseEnv(readFileSync('.env.local','utf8'));
const isolated = parseEnv(readFileSync('.env.neon-validation.local','utf8'));
if (isolated.NEON_BRANCH !== 'menupro-migration-validation') throw new Error('Se requiere la rama de validación.');
const child = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--port','3200'], {
  stdio:'inherit', env:{...process.env,...local,...isolated,APP_URL:'http://localhost:3200',MENUPRO_EMAIL_ENABLED:'false',MENUPRO_BILLING_MODE:'disabled'},
});
child.on('exit',code=>process.exit(code??1));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
