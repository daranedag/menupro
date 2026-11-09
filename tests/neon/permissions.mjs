// Real Postgres integration check, isolated by one transaction + ROLLBACK.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { connectionConfig } from '../../scripts/neon-migrations.mjs';
import { createDatabase } from '../../src/lib/neon-database.mjs';

if (process.env.NEON_BRANCH !== 'menupro-migration-validation') throw new Error('Esta prueba solo puede ejecutarse en la rama de validación.');
const client = new pg.Client(connectionConfig(process.env.DATABASE_URL_UNPOOLED));
await client.connect();
try {
  await client.query('BEGIN');
  const users = (await client.query(`INSERT INTO public.menupro_users(provider_id,email,email_verified)
    VALUES($1,$2,true),($3,$4,true),($5,'daranedag@gmail.com',true) RETURNING id`,
    [randomUUID(),'one@menupro.invalid',randomUUID(),'two@menupro.invalid',randomUUID()])).rows;
  const asUser = async (id, role='menupro_authenticated') => {
    await client.query('RESET ROLE');
    await client.query('SET LOCAL ROLE ' + role);
    await client.query("SELECT set_config('menupro.user_id',$1,true)",[id || '']);
  };
  const run = async query => {
    // Savepoints let negative authorization tests recover without losing the
    // outer transaction, so no test data can survive this script.
    await client.query('SAVEPOINT menupro_test');
    try { const result=await client.query(query); await client.query('RELEASE SAVEPOINT menupro_test'); return result; }
    catch (error) { await client.query('ROLLBACK TO SAVEPOINT menupro_test'); throw error; }
  };
  const db = createDatabase(run);
  await asUser(users[0].id);
  const session = await db.rpc('menupro_panel_session'); assert.equal(session.error,null);
  const business=session.data.business_id;
  assert.ok(business); assert.equal(session.data.is_admin,false);
  const restaurantId=await db.rpc('menupro_create_restaurant',{p_business_id:business,p_name:'Neon validation',p_slug:'neon-validation-'+randomUUID().slice(0,8),p_phone:'+56987654321',p_address:'Calle Uno 123',p_city:'Santiago'});
  assert.equal(restaurantId.error,null);
  const restaurant=(await db.from('menupro_restaurants').select('id,slug').eq('id',restaurantId.data).single()).data;
  assert.ok(restaurant);
  const trial=await db.rpc('menupro_start_trial',{ p_business_id:business,p_restaurant_id:restaurant.id,p_name:'Neon validation',p_phone:'+56987654321',p_address:'Calle Uno 123',p_city:'Santiago',p_accept_terms:true });
  assert.equal(trial.error,null); assert.equal(trial.data.status,'trial');
  const menu=await db.from('menupro_menus').select('id,slug,sections:menupro_menu_sections(id,items:menupro_menu_items(id,price,tags))').eq('restaurant_id',restaurant.id).single();
  assert.equal(menu.error,null); assert.ok(menu.data.sections[0].items.length);
  const saved=await db.from('menupro_menus').update({name:'Carta en Neon',is_published:true}).eq('id',menu.data.id).select('id,name').single();
  assert.equal(saved.data.name,'Carta en Neon');
  const dish=menu.data.sections[0].items[0];
  const updated=await db.from('menupro_menu_items').update({price:1234,tags:['vegano'],available:false}).eq('id',dish.id).select('id,price,tags,available').single();
  assert.equal(updated.error,null); assert.deepEqual(updated.data.tags,['vegano']);
  assert.equal(updated.data.available,false);
  await asUser(users[1].id);
  assert.deepEqual((await db.from('menupro_menus').select('id').eq('id',menu.data.id)).data,[]);
  assert.deepEqual((await db.from('menupro_menus').update({name:'Intrusion'}).eq('id',menu.data.id).select('id')).data,[]);
  assert.equal((await db.from('menupro_storage_objects').insert([{bucket:'menupro_fiscal',key:'bad.pdf',size:6,mime_type:'application/pdf',content:Buffer.from('%PDF-x')}])).error.code,'42501');
  assert.equal((await db.from('menupro_users').select('email')).error.code,'42501');
  await asUser(null,'menupro_anon');
  assert.equal((await db.from('menupro_menus').select('id')).error.code,'42501');
  const publicMenu=await db.rpc('menupro_public_menu',{p_restaurant_slug:restaurant.slug,p_menu_slug:menu.data.slug});
  assert.equal(publicMenu.error,null); assert.equal(publicMenu.data.menu.name,'Carta en Neon');
  assert.ok(!JSON.stringify(publicMenu.data).includes(users[0].id));
  await asUser(users[2].id);
  assert.equal((await db.rpc('menupro_panel_session')).data.is_admin,true);
  const pdf=Buffer.from('%PDF-test-data');
  const upload=await db.from('menupro_storage_objects').insert([{bucket:'menupro_fiscal',key:business+'/test.pdf',size:pdf.length,mime_type:'application/pdf',content:pdf}]);
  assert.equal(upload.error,null);
  const download=await db.from('menupro_storage_objects').select('content').eq('key',business+'/test.pdf').single();
  assert.deepEqual(download.data.content,pdf);
  await asUser(users[1].id);
  assert.equal((await db.from('menupro_storage_objects').select('content').eq('key',business+'/test.pdf').maybeSingle()).data,null);
  console.log('PASS: session, trial, nested menus, updates, public menu, tenant RLS, private PDFs, admin permissions. All fixtures rolled back.');
} finally { await client.query('ROLLBACK'); await client.end(); }
