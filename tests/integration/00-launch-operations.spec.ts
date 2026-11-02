import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { Webhook } from 'svix';
import { jsPDF } from 'jspdf';
import { account, query, session, worker } from '../helpers/backend';
const secret = readFileSync('.env.local','utf8').match(/^MENUPRO_WORKER_SECRET=(.+)$/m)![1].trim();
const monitorToken = createHmac('sha256',secret).update('menupro/operations-monitor/v1').digest('hex');
const headers = { 'x-menupro-worker-secret': secret };
const emailSecret = 'whsec_' + Buffer.from('isolated-resend-webhook-signing-key').toString('base64');

test('launch switches govern the landing and direct RPC purchases without interrupting paid renewals', async ({ browser, request }) => {
  test.setTimeout(240000);
  const admin=await account('launch-admin'); const owner=await account('launch-owner');
  const ui=await browser.newContext({storageState:await admin.context.storageState()}); const page=await ui.newPage();
  try {
    expect(query('SELECT grupo_enabled,annual_enabled FROM public.menupro_commercial_settings')[0]).toEqual({grupo_enabled:false,annual_enabled:false});
    query(`INSERT INTO public.menupro_admins(email) VALUES('${admin.email}')`);
    expect((await owner.context.post('/api/admin/commercial',{data:{grupo_enabled:true,annual_enabled:true}})).status()).toBe(403);
    expect((await owner.sdk.database.rpc('menupro_admin_set_commercial',{p_grupo_enabled:true,p_annual_enabled:true})).error).toBeTruthy();
    for (const [plan,cycle] of [['grupo','monthly'],['local','annual']]) {
      expect((await owner.sdk.database.rpc('menupro_quote',{p_business_id:owner.user.businessId,p_plan_id:plan,p_cycle:cycle})).error).toBeTruthy();
      expect((await owner.sdk.database.rpc('menupro_reserve_checkout',{p_business_id:owner.user.businessId,p_plan_id:plan,p_cycle:cycle,p_accept_renewal:true})).error).toBeTruthy();
    }
    let html=await (await request.get('/precios')).text(); expect(html).toContain('Próximamente · en desarrollo'); expect(html).toContain('Modalidad anual · próximamente');
    await page.goto('/app/dashboard/admin');
    const group=page.getByRole('switch',{name:'Habilitar plan Grupo'}); const annual=page.getByRole('switch',{name:'Habilitar modalidad anual'});
    await expect(group).not.toBeChecked(); await group.check(); await expect(page.getByRole('status').filter({hasText:'Disponibilidad actualizada'})).toBeVisible();
    await annual.check(); await expect(annual).toBeChecked();
    await expect.poll(async () => query('SELECT annual_enabled FROM public.menupro_commercial_settings')[0].annual_enabled).toBe(true);
    expect((await owner.sdk.database.rpc('menupro_quote',{p_business_id:owner.user.businessId,p_plan_id:'local',p_cycle:'annual'})).error).toBeNull();
    const reserved=await owner.sdk.database.rpc('menupro_reserve_checkout',{p_business_id:owner.user.businessId,p_plan_id:'grupo',p_cycle:'monthly',p_accept_renewal:true}); expect(reserved.error).toBeNull();
    await group.uncheck(); await expect.poll(async () => query('SELECT grupo_enabled FROM public.menupro_commercial_settings')[0].grupo_enabled).toBe(false);
    expect((await owner.sdk.database.rpc('menupro_quote',{p_business_id:owner.user.businessId,p_plan_id:'grupo',p_cycle:'monthly'})).error).toBeTruthy();
    expect((await owner.sdk.database.rpc('menupro_quote',{p_business_id:owner.user.businessId,p_plan_id:'local',p_cycle:'annual'})).error).toBeNull();
    await annual.uncheck(); await expect.poll(async () => query('SELECT annual_enabled FROM public.menupro_commercial_settings')[0].annual_enabled).toBe(false);
    const apply=worker(); const now=new Date().toISOString();
    await apply('menupro_apply_payment',{p_request_id:reserved.data.id,p_payment_id:'launch-'+randomUUID(),p_invoice_id:'launch-'+randomUUID(),p_status:'approved',p_amount:24990,p_currency:'CLP',p_approved_at:now,p_modified_at:now,p_due_at:now,p_refunded:0});
    const paid=await session(owner.context); expect(paid.subscription.plan_id).toBe('grupo'); expect(paid.subscription.has_access).toBe(true);
    await apply('menupro_apply_payment',{p_request_id:reserved.data.id,p_payment_id:'renewal-'+randomUUID(),p_invoice_id:'renewal-'+randomUUID(),p_status:'approved',p_amount:24990,p_currency:'CLP',p_approved_at:now,p_modified_at:now,p_due_at:paid.subscription.current_period_end,p_refunded:0});
    expect(Date.parse((await session(owner.context)).subscription.current_period_end)).toBeGreaterThan(Date.parse(paid.subscription.current_period_end));
    await page.screenshot({path:'artifacts/admin-launch-switches.png',fullPage:true});
  } finally { query('UPDATE public.menupro_commercial_settings SET grupo_enabled=false,annual_enabled=false'); await ui.close(); await admin.context.dispose(); await owner.context.dispose(); }
});

test('operational incidents and recoveries are deduplicated and the monitor token cannot operate payments', async ({ request }) => {
  test.setTimeout(180000);
  expect((await request.post('/api/internal/operations')).status()).toBe(401);
  expect((await request.post('/api/internal/payments',{headers:{'x-menupro-worker-secret':monitorToken}})).status()).toBe(401);
  query("UPDATE public.menupro_operation_heartbeat SET last_finished_at=now()-interval '3 hours',last_ok=true,last_external_probe_at=now()-interval '3 hours'");
  for (let i=0;i<2;i++) { const result=await request.post('/api/internal/operations',{headers}); expect(result.status(),await result.text()).toBe(200); }
  const incidents=query("SELECT id,code FROM public.menupro_operational_incidents WHERE resolved_at IS NULL AND code IN ('lifecycle_stale','external_monitor_stale')"); expect(incidents).toHaveLength(2);
  for (const incident of incidents) expect(query(`SELECT id FROM public.menupro_operational_alerts WHERE incident_id='${incident.id}' AND transition='opened'`)).toHaveLength(1);
  await worker()('menupro_record_heartbeat',{p_phase:'finished',p_ok:true});
  const result=await request.post('/api/internal/operations',{headers:{'x-menupro-monitor-secret':monitorToken}}); expect(result.status(),await result.text()).toBe(200);
  expect(query("SELECT id FROM public.menupro_operational_incidents WHERE resolved_at IS NULL AND code IN ('lifecycle_stale','external_monitor_stale')")).toHaveLength(0);
  for (const incident of incidents) expect(query(`SELECT id FROM public.menupro_operational_alerts WHERE incident_id='${incident.id}' AND transition='resolved'`)).toHaveLength(1);
});

test('administrator uploads a private PDF, sends it once with Resend and records signed delivery events', async ({ browser, request }) => {
  test.setTimeout(240000);
  const admin=await account('pdf-admin'); const owner=await account('pdf-owner'); const outsider=await account('pdf-outsider');
  const ui=await browser.newContext({storageState:await admin.context.storageState()}); const page=await ui.newPage();
  let paymentId='';
  try {
    query(`INSERT INTO public.menupro_admins(email) VALUES('${admin.email}')`);
    const reference='pdf-'+Date.now();
    const prepaid=await admin.context.post('/api/admin/prepaid',{data:{businessId:owner.user.businessId,planId:'local',cycle:'monthly',reference,reason:'Comprobante de prueba aislada de PDF.',grossAmount:9990}}); expect(prepaid.status(),await prepaid.text()).toBe(200);
    paymentId='bank:'+reference;
    const pdf=new jsPDF(); pdf.text('BOLETA DE PRUEBA - SIN VALIDEZ TRIBUTARIA',15,25); const bytes=Buffer.from(pdf.output('arraybuffer'));
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date()); const folio=String(Date.now());
    const multipart={paymentId,folio,issuedDate:date,pdf:{name:'boleta.pdf',mimeType:'application/pdf',buffer:bytes}};
    expect((await owner.context.post('/api/admin/fiscal/upload',{multipart})).status()).toBe(403);
    const invalid=await admin.context.post('/api/admin/fiscal/upload',{multipart:{...multipart,pdf:{name:'boleta.pdf',mimeType:'application/pdf',buffer:Buffer.from('not-a-real-pdf')}}}); expect(invalid.status()).toBe(400);
    await page.goto('/app/dashboard/admin'); const card=page.locator('article').filter({hasText:paymentId}); await expect(card).toBeVisible();
    await card.getByLabel('Folio emitido en el SII').fill(folio); await card.getByLabel('Fecha de emisión').fill(date);
    await card.getByLabel('PDF de la boleta '+paymentId,{exact:true}).setInputFiles({name:'boleta.pdf',mimeType:'application/pdf',buffer:bytes});
    const uploadResponse=page.waitForResponse(response=>response.url().endsWith('/api/admin/fiscal/upload')&&response.request().method()==='POST');
    await card.getByRole('button',{name:'Guardar PDF y folio'}).click(); const upload=await uploadResponse; expect(upload.status(),await upload.text()).toBe(200);
    await expect(page.getByRole('status').filter({hasText:'PDF y folio guardados'})).toBeVisible({timeout:30000});
    const doc=query(`SELECT * FROM public.menupro_fiscal_documents WHERE payment_id='${paymentId}'`)[0]; expect(doc.pdf_sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    const ownPdf=await owner.context.get('/api/billing/document/'+encodeURIComponent(paymentId)); expect(ownPdf.status(),await ownPdf.text()).toBe(200); expect(await ownPdf.body()).toEqual(bytes);
    expect((await outsider.context.get('/api/billing/document/'+encodeURIComponent(paymentId))).status()).toBe(404);
    expect([401,403,404]).toContain((await request.get(doc.storage_url)).status());
    expect((await outsider.sdk.storage.from('menupro_fiscal').download(doc.storage_key)).error).toBeTruthy();
    expect((await owner.sdk.storage.from('menupro_fiscal').upload(owner.user.businessId+'/unauthorized.pdf',new Blob([bytes],{type:'application/pdf'}))).error).toBeTruthy();
    expect((await admin.sdk.storage.from('menupro_fiscal').remove(doc.storage_key)).error).toBeTruthy();
    expect((await owner.sdk.database.from('menupro_fiscal_delivery_payloads').select('*')).error).toBeTruthy();
    await card.getByRole('button',{name:'Enviar boleta por correo'}).click(); await expect(page.getByRole('status').filter({hasText:'Boleta aceptada por Resend'})).toBeVisible({timeout:30000});
    await Promise.all([admin.context.post('/api/admin/fiscal/send',{data:{paymentId}}),admin.context.post('/api/admin/fiscal/send',{data:{paymentId}})]);
    const emails=JSON.parse(readFileSync('.insforge/resend-fixture.json','utf8')).messages.filter((item:any)=>item.payload.tags.some((tag:any)=>tag.name==='menupro_document'&&tag.value===doc.email_tag_id));
    expect(emails).toHaveLength(1); expect(emails[0].payload.to).toEqual([owner.email]); expect(Buffer.from(emails[0].payload.attachments[0].content,'base64')).toEqual(bytes);
    expect(query(`SELECT * FROM public.menupro_fiscal_delivery_payloads WHERE payment_id='${paymentId}'`)).toHaveLength(0);
    expect((await admin.context.post('/api/admin/fiscal/upload',{multipart})).status()).toBe(409);
    const event=(type:string)=>JSON.stringify({type,created_at:new Date().toISOString(),data:{email_id:emails[0].id,tags:{menupro_document:doc.email_tag_id}}});
    const delivered=event('email.delivered'); expect((await request.post('/api/emails/resend/webhook',{data:delivered,headers:{'content-type':'application/json'}})).status()).toBe(401);
    async function hook(payload:string) { const id='msg_'+randomUUID();const timestamp=new Date();return request.post('/api/emails/resend/webhook',{data:payload,headers:{'content-type':'application/json','svix-id':id,'svix-timestamp':String(Math.floor(timestamp.getTime()/1000)),'svix-signature':new Webhook(emailSecret).sign(id,timestamp,payload)}}); }
    let response=await hook(event('email.delivery_delayed')); expect(response.status(),await response.text()).toBe(200); expect(query(`SELECT delivery_state FROM public.menupro_fiscal_documents WHERE payment_id='${paymentId}'`)[0].delivery_state).toBe('delayed');
    response=await hook(event('email.sent')); expect(response.status()).toBe(200); expect(query(`SELECT delivery_state FROM public.menupro_fiscal_documents WHERE payment_id='${paymentId}'`)[0].delivery_state).toBe('delayed');
    response=await hook(delivered); expect(response.status(),await response.text()).toBe(200); expect(query(`SELECT delivery_state FROM public.menupro_fiscal_documents WHERE payment_id='${paymentId}'`)[0].delivery_state).toBe('delivered');
    response=await hook(event('email.sent')); expect(response.status(),await response.text()).toBe(200); expect(query(`SELECT delivery_state FROM public.menupro_fiscal_documents WHERE payment_id='${paymentId}'`)[0].delivery_state).toBe('delivered');
    await page.getByLabel('Estado de boletas').selectOption('issued'); await expect(card.getByText('Entregada al servidor de correo del cliente')).toBeVisible(); await page.screenshot({path:'artifacts/admin-fiscal-pdf.png',fullPage:true});
    response=await hook(event('email.bounced')); expect(response.status()).toBe(200);
    await request.post('/api/internal/operations',{headers}); expect(query("SELECT id FROM public.menupro_operational_incidents WHERE code='fiscal_delivery' AND resolved_at IS NULL")).toHaveLength(1);
  } finally { if(paymentId) query(`UPDATE public.menupro_fiscal_documents SET delivery_state='delivered' WHERE payment_id='${paymentId}' AND email_accepted_at IS NOT NULL`); await ui.close();await Promise.all([admin.context.dispose(),owner.context.dispose(),outsider.context.dispose()]); }
});
