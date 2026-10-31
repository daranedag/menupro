import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { createAuthActions } from '@insforge/sdk/ssr';
import { z } from 'zod';
import { createInsForge, createPublicInsForge } from './insforge';
import { assertSameOrigin, check, fail, HttpError, respond } from './http';
import { credentials, restaurantSchema, menuSchema, sectionSchema, dishSchema, menuWrite, sectionWrite, dishWrite } from './schemas';
import { slugify, toMenu, toSection, toDish } from '@/lib/menu.mjs';
import { businessSession, handleBusinessApi } from './business';
import { enforceRequestLimit } from './security';

type Client = Awaited<ReturnType<typeof createInsForge>>;
const restaurantColumns = 'id,business_id,name,slug,phone,address,city,unit,no_physical_location,currency,theme,active,archived_at';
const itemColumns = 'id,section_id,name,description,long_description,price,discount,image_url,tags,calories,prep_time,is_vegetarian,is_spicy,available,visible,order_index';
const sectionColumns = 'id,menu_id,name,description,icon,active,visible,order_index';
const menuColumns = 'id,restaurant_id,name,slug,description,icon,is_published,active,visible,show_call_to_action,cta_title,cta_description,phone_number,delivery_url';
const menuTree = `${menuColumns},sections:menupro_menu_sections(${sectionColumns},items:menupro_menu_items(${itemColumns}))`;

async function body(request: Request) {
  const text = await request.text();
  if (text.length > 65536) throw new HttpError('La solicitud es demasiado grande.', 413);
  try { return JSON.parse(text); } catch { throw new HttpError('Datos JSON inválidos.'); }
}

async function session(client: Client, user: { id: string; email?: string; profile?: Record<string, unknown> | null }) {
  const defaultName = (typeof user.profile?.name === 'string' && user.profile.name.trim())
    || user.email?.split('@')[0] || '';
  const context = await businessSession(client);
  const restaurants = context.restaurants;
  const profile = await client.database.from('menupro_profiles').select('id,name').eq('id', user.id).maybeSingle();
  check(profile.error);
  if (!profile.data) {
    const inserted = await client.database.from('menupro_profiles').insert([{ id: user.id, name: defaultName }]);
    if (inserted.error?.code !== '23505') check(inserted.error);
  }
  const selected = (await cookies()).get('menupro_restaurant')?.value;
  const activeRestaurant = restaurants?.find(restaurant => restaurant.id === selected) ?? restaurants?.[0];
  return { id: user.id, email: user.email, name: profile.data?.name ?? defaultName,
    role: context.is_admin ? 'platform_admin' : 'restaurant_owner', isAdmin: context.is_admin,
    businesses: context.businesses, businessId: context.business_id, businessRole: context.business_role,
    subscription: context.subscription, invitations: context.invitations,
    restaurants: restaurants ?? [], activeRestaurantId: activeRestaurant?.id, activeRestaurantName: activeRestaurant?.name,
    activeRestaurantSlug: activeRestaurant?.slug, subscriptionTier: context.subscription?.plan_name,
    maxRestaurants: context.subscription?.max_restaurants, canEdit: context.subscription?.has_access && !activeRestaurant?.archived_at && activeRestaurant?.entitled !== false };
}

async function menuById(client: Client, id: string) {
  const result = await client.database.from('menupro_menus').select(menuTree).eq('id', id).maybeSingle();
  check(result.error);
  if (!result.data) throw new HttpError('Carta no encontrada.', 404);
  return toMenu(result.data);
}

export async function handleApi(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const method = request.method;
    if (method !== 'GET') assertSameOrigin(request);
    if (path.join('/') === 'health' && method === 'GET') return respond({ status: 'ok', application: 'MenuPro' });
    const client = await createInsForge();

    if (path[0] === 'auth' && path.length === 2 && ['login', 'register', 'verify', 'logout'].includes(path[1]) && method === 'POST') {
      if (path[1] !== 'logout') await enforceRequestLimit(request, 'auth_' + path[1], path[1] === 'login' ? 100 : 20);
      const auth = createAuthActions({ cookies: await cookies() });
      if (path[1] === 'logout') {
        const result = await auth.signOut();
        if (result.error) throw new HttpError('No se pudo cerrar la sesión.', result.error.statusCode ?? 400);
        return respond(null);
      }
      if (path[1] === 'verify') {
        const input = z.object({ email: z.string().email(), otp: z.string().regex(/^\d{6}$/) }).strict().parse(await body(request));
        const { data, error } = await auth.verifyEmail(input);
        if (error) throw new HttpError(error.message ?? 'Código inválido.', error.statusCode ?? 400);
        return respond({ verified: true, user: data?.user ? { id: data.user.id, email: data.user.email } : null });
      }
      const input = (path[1] === 'register' ? credentials : credentials.extend({ password: z.string().min(1).max(128) })).parse(await body(request));
      const result = path[1] === 'register'
        ? await auth.signUp({ email: input.email, password: input.password, name: input.name,
          redirectTo: new URL('/app/login?verified=true', request.url).toString() })
        : await auth.signInWithPassword({ email: input.email, password: input.password });
      if (result.error) throw new HttpError(result.error.message ?? 'No se pudo iniciar sesión.', result.error.statusCode ?? 400);
      const safe = result.data as { user?: { id: string; email?: string }; requireEmailVerification?: boolean; verifyEmailMethod?: string } | null;
      if (safe?.requireEmailVerification) return respond({ requiresEmailConfirmation: true, verifyEmailMethod: safe.verifyEmailMethod });
      if (!safe?.user) throw new HttpError('No se pudo iniciar sesión.', 401);
      const signedClient = await createInsForge();
      return respond({ user: await session(signedClient, safe.user) });
    }

    if (path[0] === 'menus' && path[1] === 'public' && path.length === 4 && method === 'GET') {
      const { data, error } = await createPublicInsForge().database.rpc('menupro_public_menu', { p_restaurant_slug: path[2], p_menu_slug: path[3] });
      check(error);
      if (!data) throw new HttpError('Carta no encontrada o no publicada.', 404);
      if (data.unavailable) return respond({ unavailable: true });
      return respond({ restaurant: data.restaurant, menu: toMenu(data.menu) });
    }

    const { data: userData, error: authError } = await client.auth.getCurrentUser();
    if (authError || !userData?.user) throw new HttpError('Debes iniciar sesión.', 401);
    const user = userData.user;

    const businessResponse = await handleBusinessApi(request, path, client, user);
    if (businessResponse) return businessResponse;

    if (path.join('/') === 'auth/session' && method === 'GET') return respond({ user: await session(client, user) });
    if (path.join('/') === 'auth/restaurant' && method === 'POST') {
      const { id } = z.object({ id: z.string().uuid() }).strict().parse(await body(request));
      const result = await client.database.from('menupro_restaurants').select('id').eq('id', id).maybeSingle();
      check(result.error);
      if (!result.data) throw new HttpError('Restaurante no encontrado.', 404);
      (await cookies()).set('menupro_restaurant', id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
      return respond(null);
    }
    if (path.join('/') === 'auth/profile' && method === 'PUT') {
      const input = z.object({ name: z.string().trim().min(1).max(255) }).strict().parse(await body(request));
      const result = await client.database.from('menupro_profiles').update(input).eq('id', user.id).select('name').single();
      check(result.error); return respond(result.data);
    }

    if (path[0] === 'restaurants' && path.length <= 2) {
      if (method === 'GET') {
        const context = await businessSession(client);
        const query = client.database.from('menupro_restaurants').select(restaurantColumns).eq('business_id', context.business_id);
        const result = path[1] ? await query.eq('id', z.string().uuid().parse(path[1])).maybeSingle() : await query.order('created_at').limit(100);
        check(result.error);
        if (path[1] && !result.data) throw new HttpError('Restaurante no encontrado.', 404);
        return respond(result.data);
      }
      if (method === 'POST' && path.length === 1) {
        const input = restaurantSchema.parse(await body(request));
        const slug = input.slug || slugify(input.name);
        if (!slug) throw new HttpError('Ingresa un nombre o slug válido.');
        const context = await businessSession(client);
        const args = { p_business_id: context.business_id,
          p_name: input.name, p_slug: slug, p_phone: input.phone ?? '', p_address: input.address ?? '', p_city: input.city ?? '',
          p_unit: input.unit ?? '', p_no_physical_location: input.no_physical_location ?? false };
        let created = await client.database.rpc('menupro_create_restaurant', args);
        if (created.error?.code === '23505' && !input.slug) {
          created = await client.database.rpc('menupro_create_restaurant', { ...args, p_slug: slug.slice(0, 90) + '-' + randomUUID().slice(0, 8) });
        }
        check(created.error);
        const result = await client.database.from('menupro_restaurants').select(restaurantColumns).eq('id', created.data).single();
        check(result.error); return respond(result.data, 201);
      }
      if (method === 'PATCH' && path.length === 2) {
        const input = restaurantSchema.partial().parse(await body(request));
        const result = await client.database.from('menupro_restaurants').update(input).eq('id', z.string().uuid().parse(path[1]))
          .select(restaurantColumns).maybeSingle();
        check(result.error); if (!result.data) throw new HttpError('Restaurante no encontrado.', 404);
        return respond(result.data);
      }
    }

    if (path[0] === 'menus' && path[1] === 'restaurant' && path.length === 3 && method === 'GET') {
      const restaurantId = z.string().uuid().parse(path[2]);
      const menus = [];
      for (let offset = 0; ; offset += 100) {
        const result = await client.database.from('menupro_menus').select(menuTree).eq('restaurant_id', restaurantId).order('created_at').range(offset, offset + 99);
        check(result.error); menus.push(...(result.data ?? [])); if (!result.data || result.data.length < 100) break;
      }
      return respond(menus.map(toMenu));
    }
    if (path.join('/') === 'menus' && method === 'POST') {
      const input = menuSchema.parse(await body(request));
      const slug = slugify(input.name);
      if (!slug) throw new HttpError('Ingresa un nombre con letras o números.');
      const result = await client.database.from('menupro_menus').insert([{ ...menuWrite(input), slug }]).select('id').single();
      check(result.error); return respond(await menuById(client, result.data!.id), 201);
    }
    if (path[0] === 'menus' && path[1] !== 'sections' && path.length >= 2) {
      const id = z.string().uuid().parse(path[1]);
      if (path.length === 2 && method === 'GET') return respond(await menuById(client, id));
      if (path.length === 2 && method === 'PATCH') {
        const raw = await body(request);
        const input = menuSchema.partial().parse(raw);
        const complete = menuWrite(input as z.infer<typeof menuSchema>);
        delete (complete as Partial<typeof complete>).restaurant_id;
        const result = await client.database.from('menupro_menus').update(complete).eq('id', id).select('id').maybeSingle();
        check(result.error); if (!result.data) throw new HttpError('Carta no encontrada.', 404);
        return respond(await menuById(client, id));
      }
      if (path.length === 2 && method === 'DELETE') {
        const result = await client.database.from('menupro_menus').delete().eq('id', id).select('id').maybeSingle();
        check(result.error); if (!result.data) throw new HttpError('Carta no encontrada.', 404);
        return respond(null);
      }
      if (path.length === 3 && path[2] === 'publish' && method === 'PATCH') {
        const input = z.object({ publish: z.boolean() }).strict().parse(await body(request));
        const result = await client.database.from('menupro_menus').update({ is_published: input.publish }).eq('id', id).select('id').maybeSingle();
        check(result.error); if (!result.data) throw new HttpError('Carta no encontrada.', 404);
        return respond(await menuById(client, id));
      }
      if (path[2] === 'sections' && path.length === 3) {
        if (method === 'GET') {
          const result = await client.database.from('menupro_menu_sections').select(`${sectionColumns},items:menupro_menu_items(${itemColumns})`).eq('menu_id', id).order('order_index').limit(500);
          check(result.error); return respond((result.data ?? []).map(toSection));
        }
        if (method === 'POST') {
          const input = sectionSchema.parse(await body(request));
          const result = await client.database.from('menupro_menu_sections').insert([{ ...sectionWrite(input), menu_id: id }]).select(sectionColumns).single();
          check(result.error); return respond(toSection(result.data), 201);
        }
      }
      if (path[2] === 'sections' && path[3] === 'reorder' && path.length === 4 && method === 'PATCH') {
        const input = z.object({ ids: z.array(z.string().uuid()).max(500) }).strict().parse(await body(request));
        const result = await client.database.rpc('menupro_reorder_sections', { p_menu_id: id, p_ids: input.ids });
        check(result.error); return respond(null);
      }
    }

    if (path[0] === 'sections' && path.length >= 2) {
      const id = z.string().uuid().parse(path[1]);
      if (path.length === 2 && method === 'PATCH') {
        const input = sectionSchema.partial().parse(await body(request));
        const result = await client.database.from('menupro_menu_sections').update(sectionWrite(input as z.infer<typeof sectionSchema>)).eq('id', id).select(sectionColumns).maybeSingle();
        check(result.error); if (!result.data) throw new HttpError('Sección no encontrada.', 404);
        return respond(toSection(result.data));
      }
      if (path.length === 2 && method === 'DELETE') {
        const result = await client.database.from('menupro_menu_sections').delete().eq('id', id).select('id').maybeSingle();
        check(result.error); if (!result.data) throw new HttpError('Sección no encontrada.', 404);
        return respond(null);
      }
      if (path[2] === 'items' && path.length === 3) {
        if (method === 'GET') {
          const result = await client.database.from('menupro_menu_items').select(itemColumns).eq('section_id', id).order('order_index').limit(1000);
          check(result.error); return respond((result.data ?? []).map(toDish));
        }
        if (method === 'POST') {
          const input = dishSchema.parse(await body(request));
          const result = await client.database.from('menupro_menu_items').insert([{ ...dishWrite(input), section_id: id }]).select(itemColumns).single();
          check(result.error); return respond(toDish(result.data), 201);
        }
      }
      if (path[2] === 'items' && path[3] === 'reorder' && path.length === 4 && method === 'PATCH') {
        const input = z.object({ ids: z.array(z.string().uuid()).max(1000) }).strict().parse(await body(request));
        const result = await client.database.rpc('menupro_reorder_items', { p_section_id: id, p_ids: input.ids });
        check(result.error); return respond(null);
      }
    }
    if (path[0] === 'items' && path.length === 2) {
      const id = z.string().uuid().parse(path[1]);
      if (method === 'PATCH') {
        const input = dishSchema.partial().parse(await body(request));
        const result = await client.database.from('menupro_menu_items').update(dishWrite(input as z.infer<typeof dishSchema>)).eq('id', id).select(itemColumns).maybeSingle();
        check(result.error); if (!result.data) throw new HttpError('Plato no encontrado.', 404);
        return respond(toDish(result.data));
      }
      if (method === 'DELETE') {
        const result = await client.database.from('menupro_menu_items').delete().eq('id', id).select('id').maybeSingle();
        check(result.error); if (!result.data) throw new HttpError('Plato no encontrado.', 404);
        return respond(null);
      }
    }
    throw new HttpError('Ruta no encontrada.', 404);
  } catch (error) { return fail(error); }
}
