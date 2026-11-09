import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../src/lib/neon-database.mjs';
import { adaptInsForgeSql, migrationSources } from '../scripts/neon-migrations.mjs';

const db = createDatabase(async () => ({ rows: [] }));
test('all filter and mutation values stay out of SQL', () => {
  const malicious = "x'); DROP TABLE public.menupro_menus; --";
  const query = db.from('menupro_menus').update({ name: malicious }).eq('id','example').select('id,name').compile();
  assert.ok(!query.text.includes(malicious));
  assert.deepEqual(query.values,['example',malicious]);
  assert.match(query.text,/SET "name"=\$2 WHERE t\."id"=\$1 RETURNING/);
  assert.throws(() => db.from('auth_users'));
  assert.throws(() => db.from('menupro_menus').eq('id;drop table x','x').compile());
});
test('JSON arrays and SQL arrays keep their respective encodings', () => {
  const query = db.from('menupro_menu_items').insert([{ tags: ['vegano'],name:'Plato' }]).compile();
  assert.match(query.text,/INSERT INTO public\."menupro_menu_items" AS t/);
  assert.equal(query.values[0],'["vegano"]');
});
test('nested menu reads and incident relation are correlated', () => {
  const menu = db.from('menupro_menus').select('id,sections:menupro_menu_sections(id,items:menupro_menu_items(id,price))').compile();
  assert.match(menu.text,/r0\."menu_id"=t\.id/);
  assert.match(menu.text,/r1\."section_id"=r0\.id/);
  const incident = db.from('menupro_operational_alerts').select('id,incident:menupro_operational_incidents(*)').compile();
  assert.match(incident.text,/r0\.id=t\."incident_id"/);
  assert.throws(() => db.from('menupro_menus').select('users:menupro_users(*)').compile());
});
test('OR filters with nested lists are parameterized', () => {
  const query = db.from('menupro_fiscal_documents').select('id').or('status.eq.pending,email_accepted_at.is.null,delivery_state.in.(failed,unknown)').compile();
  assert.match(query.text,/IS NULL/);
  assert.deepEqual(query.values,['pending','failed','unknown']);
});
test('cardinality errors and database permissions propagate through await', async () => {
  const multiple = createDatabase(async () => ({ rows: [{id:1},{id:2}] }));
  assert.equal((await multiple.from('menupro_menus').single()).error.code,'PGRST116');
  assert.equal((await db.from('menupro_menus').maybeSingle()).data,null);
  const denied = createDatabase(async () => { throw Object.assign(new Error('denied'),{code:'42501'}); });
  assert.equal((await denied.rpc('menupro_panel_session')).error.code,'42501');
});
test('RPC names and arguments cannot inject SQL', async () => {
  let captured;
  const client = createDatabase(async query => { captured=query; return {rows:[{data:true}]}; });
  const ids=['a','b'];
  assert.equal((await client.rpc('menupro_reorder_items',{p_ids:ids})).data,true);
  assert.deepEqual(captured.values,[ids]);
  assert.match(captured.text,/"p_ids" => \$1/);
  assert.ok((await client.rpc('pg_sleep',{seconds:10})).error);
});
test('legacy migrations map only the documented platform objects', async () => {
  const source='SELECT auth.uid() FROM auth.users; GRANT SELECT ON storage.objects TO anon,authenticated;';
  assert.equal(adaptInsForgeSql(source),'SELECT public.menupro_auth_uid() FROM public.menupro_users; GRANT SELECT ON public.menupro_storage_objects TO menupro_anon,menupro_authenticated;');
  assert.ok((await migrationSources()).length >= 27);
});
