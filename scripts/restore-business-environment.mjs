import { readFileSync,writeFileSync } from 'node:fs';
const project=JSON.parse(readFileSync('.insforge/project.json','utf8'));
if(project.project_id!=='1f6ed00c-76be-4883-92e6-ca3dabee7e68') throw Error('Vuelve primero al backend principal con el CLI.');
const backup=readFileSync('.insforge/env-before-business.local','utf8');
if(backup.match(/^NEXT_PUBLIC_INSFORGE_URL=(.+)$/m)?.[1].trim()!==project.oss_host) throw Error('El respaldo no pertenece al proyecto principal.');
let current=readFileSync('.env.local','utf8');
for(const name of ['NEXT_PUBLIC_INSFORGE_URL','NEXT_PUBLIC_INSFORGE_ANON_KEY','MENUPRO_WORKER_SECRET','MENUPRO_BILLING_MODE','MENUPRO_EMAIL_ENABLED']) {
  const original=backup.match(new RegExp('^'+name+'=(.*)$','m'))?.[0];
  if(!original) { current=current.replace(new RegExp('^'+name+'=.*\\r?\\n?','m'),''); continue; }
  current=new RegExp('^'+name+'=','m').test(current)?current.replace(new RegExp('^'+name+'=.*$','m'),original):current+'\n'+original+'\n';
}
writeFileSync('.env.local',current);
console.log(JSON.stringify({backend:project.oss_host,restored:true,billingMode:current.match(/^MENUPRO_BILLING_MODE=(.*)$/m)?.[1].trim()}));
