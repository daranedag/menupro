import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { connectionConfig } from '../../scripts/neon-migrations.mjs';

test('Neon: real login, browser session, trial, public menu and tenant isolation', async ({ playwright, browser }) => {
  const env=parseEnv(readFileSync('.env.neon-validation.local','utf8'));
  if(env.NEON_BRANCH!=='menupro-migration-validation') throw new Error('Use the validation branch only');
  const sql=new pg.Client(connectionConfig(env.DATABASE_URL_UNPOOLED)); await sql.connect();
  const suffix=randomBytes(7).toString('hex'); const email=`neon-${suffix}@menupro.invalid`;
  const password=randomBytes(24).toString('base64url');
  const api=await playwright.request.newContext({baseURL:'http://localhost:3200',extraHTTPHeaders:{Origin:'http://localhost:3200'}});
  try {
    expect((await api.get('/api/auth/session')).status()).toBe(401);
    const registration=await api.post('/api/auth/register',{data:{email,password}});
    expect(registration.status()).toBe(200);
    expect((await registration.json()).data.requiresEmailConfirmation).toBe(true);
    // Synthetic test identities only; branch mail is disabled. No real person
    // receives a message and production's verification rules are untouched.
    await sql.query('UPDATE neon_auth."user" SET "emailVerified"=true WHERE email=$1',[email]);
    await api.post('/api/auth/logout');
    expect((await api.post('/api/auth/login',{data:{email,password:'incorrect-password'}})).status()).toBe(401);
    const login=await api.post('/api/auth/login',{data:{email,password}});
    expect(login.status(), (await login.json()).error).toBe(200);
    const session=(await login.json()).data.user; expect(session.email).toBe(email);
    expect(session.role).toBe('restaurant_owner'); expect(session.businessId).toBeTruthy();
    const restaurantResponse=await api.post('/api/restaurants',{data:{name:'Neon '+suffix,slug:'neon-'+suffix}});
    expect(restaurantResponse.status()).toBe(201);
    const restaurant=(await restaurantResponse.json()).data;
    const trial=await api.post('/api/business/trial',{data:{restaurantId:restaurant.id,name:'Neon '+suffix,phone:'+569'+String(Math.floor(Math.random()*89999999)+10000000),address:'Calle '+suffix,city:'Santiago',acceptTerms:true}});
    expect(trial.status()).toBe(200); expect((await trial.json()).data.status).toBe('trial');
    const menus=await api.get('/api/menus/restaurant/'+restaurant.id);
    expect(menus.status()).toBe(200); const menu=(await menus.json()).data[0];
    expect(menu.sections[0].items.length).toBeGreaterThan(0);
    const published=await api.patch('/api/menus/'+menu.id+'/publish',{data:{publish:true}});
    expect(published.status()).toBe(200);
    const anonymous=await playwright.request.newContext({baseURL:'http://localhost:3200'});
    const publicMenu=await anonymous.get('/api/menus/public/'+restaurant.slug+'/'+menu.slug);
    expect(publicMenu.status()).toBe(200); expect((await publicMenu.json()).data.menu.id).toBe(menu.id);
    expect((await anonymous.get('/api/menus/'+menu.id)).status()).toBe(401);
    expect((await anonymous.post('/api/internal/lifecycle')).status()).toBe(401);
    expect((await api.get('/api/billing')).status()).toBe(200);
    const google=await api.post('/api/auth/google'); expect(google.status()).toBe(200);
    const oauthUrl=new URL((await google.json()).data.url);
    expect(oauthUrl.protocol).toBe('https:');
    expect(oauthUrl.hostname).toBe(new URL(env.NEON_AUTH_BASE_URL).hostname);
    const context=await browser.newContext({storageState:await api.storageState()});
    const page=await context.newPage();
    await page.goto('http://localhost:3200/app/dashboard');
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(page.getByText('Neon '+suffix).first()).toBeVisible();
    await page.reload(); await expect(page).toHaveURL(/\/app\/dashboard/);
    await context.close();
    await api.post('/api/auth/logout');
    expect((await api.get('/api/auth/session')).status()).toBe(401);
    await anonymous.dispose();
  } finally { await api.dispose(); await sql.end(); }
});
