import { test, expect } from '@playwright/test';
import { account, query, restaurant, session, startTrial } from '../helpers/backend';

test('optional image connections enforce paid access, tenant isolation and preserve assigned photos after disconnect', async () => {
  test.setTimeout(240000);
  const a = await account('images-a'); const b = await account('images-b');
  const sourceInput = { provider: 'public', name: 'Mis platos', baseUrl: 'https://cdn.example.com/platos', folder: '/' };
  try {
    const r = await restaurant(a.context, 'Biblioteca ' + Date.now());
    expect((await startTrial(a.context, r)).status()).toBe(200);
    const owner = await session(a.context);
    expect((await (await a.context.get('/api/images')).json()).data.eligible).toBe(false);
    expect((await a.context.put('/api/images/source', { data: sourceInput })).status()).toBe(403);
    expect((await a.sdk.database.from('menupro_image_sources').insert([{ business_id: owner.businessId, provider: 'public', name: 'No', base_url: sourceInput.baseUrl }])).error).toBeTruthy();
    // A courtesy with an active-looking subscription still cannot grant images.
    query(`UPDATE public.menupro_subscriptions SET status='active',current_period_end=now()+interval '30 days',courtesy_until=now()+interval '60 days' WHERE business_id='${owner.businessId}'`);
    expect((await (await a.context.get('/api/images')).json()).data.eligible).toBe(false);
    query(`WITH c AS (INSERT INTO public.menupro_checkout_requests(business_id,plan_id,cycle,purpose,net_amount,gross_amount,regular_gross,starts_at,status) VALUES('${owner.businessId}','local','monthly','prepaid',9990,11888,11888,now(),'paid') RETURNING id) INSERT INTO public.menupro_payment_events(provider_payment_id,request_id,business_id,status,amount,currency,period_start,period_end,approved_at,provider_modified_at) SELECT 'image-test-'||id,id,'${owner.businessId}','approved',11888,'CLP',now(),now()+interval '30 days',now(),now() FROM c`);
    let response = await a.context.put('/api/images/source', { data: sourceInput });
    expect(response.status(), await response.text()).toBe(200);
    const source = (await response.json()).data;
    expect(source.encrypted_key).toBeUndefined();
    expect((await b.sdk.database.from('menupro_image_sources').select('id')).data).toEqual([]);
    expect((await b.sdk.database.rpc('menupro_register_image', { p_source_id: source.id, p_url: sourceInput.baseUrl + '/pizza.jpg', p_name: 'Intruso' })).error).toBeTruthy();
    const other = await session(b.context);
    const foreignAsset = query(`INSERT INTO public.menupro_image_assets(business_id,name,original_url,url) VALUES('${other.businessId}','Otro negocio','https://other.example.com/a.jpg','https://other.example.com/a.jpg') RETURNING id`)[0];
    response = await a.context.post('/api/images/assets', { data: { url: 'pizza.jpg', name: 'Pizza' } });
    expect(response.status(), await response.text()).toBe(201);
    const asset = (await response.json()).data;
    expect((await a.context.post('/api/images/assets', { data: { url: '../outside.jpg', name: 'No' } })).status()).toBe(400);
    expect((await a.sdk.database.from('menupro_image_assets').insert([{ business_id: owner.businessId, name: 'No', original_url: asset.url, url: asset.url }])).error).toBeTruthy();
    const menuResponse = await a.context.post('/api/menus', { data: { restaurant_id: r.id, name: 'Fotos opcionales' } });
    expect(menuResponse.status(), await menuResponse.text()).toBe(201); const menu = (await menuResponse.json()).data;
    const sectionResponse = await a.context.post(`/api/menus/${menu.id}/sections`, { data: { name: 'Platos' } });
    expect(sectionResponse.status(), await sectionResponse.text()).toBe(201); const section = (await sectionResponse.json()).data;
    response = await a.context.post(`/api/sections/${section.id}/items`, { data: { name: 'Sin foto', price: 1000 } });
    expect(response.status(), await response.text()).toBe(201); const item = (await response.json()).data;
    expect((await a.sdk.database.from('menupro_menu_items').update({ image_asset_id: foreignAsset.id }).eq('id', item.id)).error).toBeTruthy();
    response = await a.context.patch(`/api/items/${item.id}`, { data: { imageAssetId: asset.id, image: 'https://wrong.example.com/wrong.jpg' } });
    expect(response.status(), await response.text()).toBe(200);
    expect((await response.json()).data.image).toBe(asset.url);
    query(`INSERT INTO public.menupro_memberships(business_id,user_id,role) VALUES('${owner.businessId}','${b.user.id}','editor')`);
    expect((await b.context.post('/api/business/select', { data: { id: owner.businessId } })).status()).toBe(200);
    expect((await b.context.put('/api/images/source', { data: sourceInput })).status()).toBe(403);
    expect((await b.context.post('/api/images/assets', { data: { url: 'postre.jpg', name: 'Postre' } })).status()).toBe(201);
    query(`UPDATE public.menupro_subscriptions SET current_period_end=now()-interval '1 second' WHERE business_id='${owner.businessId}'`);
    expect((await (await a.context.get('/api/images')).json()).data.eligible).toBe(false);
    expect((await a.context.post('/api/images/assets', { data: { url: 'otro.jpg', name: 'Otra' } })).status()).toBe(403);
    // Courtesy keeps ordinary edits available, but cannot add another library image.
    response = await a.context.patch(`/api/items/${item.id}`, { data: { price: 1200, image: asset.url, imageAssetId: asset.id } });
    expect(response.status(), await response.text()).toBe(200);
    expect((await a.context.post(`/api/sections/${section.id}/items`, { data: { name: 'Bloqueada', price: 1000, imageAssetId: asset.id } })).status()).toBe(403);
    expect((await a.context.delete('/api/images/source')).status()).toBe(200);
    response = await a.context.get(`/api/menus/${menu.id}`);
    expect((await response.json()).data.sections[0].items[0].image).toBe(asset.url);
    expect((await a.sdk.database.from('menupro_image_assets').select('source_id,original_url').eq('id', asset.id).single()).data).toMatchObject({ source_id: null, original_url: asset.url });
    expect((await a.context.patch(`/api/items/${item.id}`, { data: { image: '', imageAssetId: null } })).status()).toBe(200);
  } finally { await a.context.dispose(); await b.context.dispose(); }
});
