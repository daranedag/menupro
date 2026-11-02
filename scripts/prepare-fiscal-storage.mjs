import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const project=JSON.parse(readFileSync('.insforge/project.json','utf8'));
const env=readFileSync('.env.local','utf8');
if (env.match(/^NEXT_PUBLIC_INSFORGE_URL=(.+)$/m)?.[1].trim()!==project.oss_host) throw Error('La aplicación y el CLI deben apuntar al mismo backend.');
function cli(args) {
  const result=spawnSync(process.execPath,['node_modules/@insforge/cli/dist/index.js',...args,'--json'],{encoding:'utf8',timeout:60000});
  if(result.status!==0) throw Error('No se pudo preparar el almacenamiento fiscal.'); return JSON.parse(result.stdout);
}
const state=cli(['db','query',"SELECT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) AS rls_enabled,(SELECT public FROM storage.buckets WHERE name='menupro_fiscal') AS bucket_public"] ).rows[0];
if(!state.rls_enabled) throw Error('El almacenamiento compartido no tiene aislamiento activo. Revisa sus políticas antes de continuar; no se modificaron otros buckets.');
if(state.bucket_public===true) throw Error('menupro_fiscal existe como público. No se permite guardar boletas allí.');
if(state.bucket_public===null) cli(['storage','create-bucket','menupro_fiscal','--private']);
console.log(JSON.stringify({backend:project.oss_host,bucket:'menupro_fiscal',private:true,rlsEnabled:true}));
