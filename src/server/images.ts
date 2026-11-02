import 'server-only';
import { z } from 'zod';
import { businessSession, readJson, type BusinessClient } from './business';
import { check, HttpError, respond } from './http';
import { publicImageUrl, imageWithinSource } from '@/lib/image-library.mjs';
import { encryptImageKey, decryptImageKey, listImageKit } from './image-provider.mjs';
import { enforceRequestLimit } from './security';

const columns = 'id,business_id,provider,name,base_url,folder';
const sourceSchema = z.object({ provider: z.enum(['imagekit', 'public']), name: z.string().trim().min(1).max(100),
  baseUrl: z.string().max(2048), folder: z.string().trim().max(500).regex(/^\/(?:[^\u0000-\u001f])*$/).default('/'),
  privateKey: z.string().trim().max(500).optional() }).strict();

function invalid(error: unknown): never { throw new HttpError(error instanceof Error ? error.message : 'No se pudo consultar el servidor de imágenes.'); }

export async function handleImagesApi(request: Request, path: string[], client: BusinessClient) {
  if (path[0] !== 'images') return null;
  const context = await businessSession(client);
  const paid = await client.database.rpc('menupro_has_paid_images', { p_business_id: context.business_id });
  check(paid.error);
  const eligible = paid.data === true;
  const method = request.method;
  const route = path.join('/');
  const sourceResult = await client.database.from('menupro_image_sources').select(columns).eq('business_id', context.business_id).maybeSingle();
  check(sourceResult.error);
  const source = sourceResult.data;
  if (route === 'images' && method === 'GET') {
    return respond({ eligible, canManage: eligible && ['owner', 'manager'].includes(context.business_role), canDisconnect: ['owner', 'manager'].includes(context.business_role), source,
      imagekitReady: /^[a-f0-9]{64}$/i.test(process.env.MENUPRO_IMAGE_ENCRYPTION_KEY || '') });
  }
  if (route === 'images/source' && method === 'DELETE') {
    if (!['owner', 'manager'].includes(context.business_role)) throw new HttpError('Solo el propietario o un encargado puede desconectar el servidor.', 403);
    const result = await client.database.from('menupro_image_sources').delete().eq('business_id', context.business_id);
    check(result.error); return respond(null);
  }
  if (!eligible) throw new HttpError('La biblioteca de imágenes requiere una suscripción pagada vigente.', 403);
  if (route === 'images/source' && method === 'PUT') {
    if (!['owner', 'manager'].includes(context.business_role)) throw new HttpError('Solo el propietario o un encargado puede conectar el servidor.', 403);
    const input = sourceSchema.parse(await readJson(request));
    let baseUrl: string;
    try { baseUrl = publicImageUrl(input.baseUrl).replace(/\/$/, ''); } catch (error) { invalid(error); }
    let encryptedKey: string | null = null;
    if (input.provider === 'imagekit') {
      await enforceRequestLimit(request, 'imagekit_connect', 20);
      let privateKey = input.privateKey;
      if (!privateKey && source?.provider === 'imagekit') {
        const secret = await client.database.from('menupro_image_sources').select('encrypted_key').eq('id', source.id).single();
        check(secret.error);
        if (!secret.data?.encrypted_key) throw new HttpError('Vuelve a guardar la clave de ImageKit.');
        try { privateKey = decryptImageKey(secret.data.encrypted_key, context.business_id); } catch (error) { invalid(error); }
      }
      if (!privateKey || !/^private_[\w+=/-]+$/.test(privateKey)) throw new HttpError('Ingresa la clave privada de ImageKit con permiso de lectura de medios.');
      try {
        await listImageKit({ privateKey, baseUrl, folder: input.folder, offset: 0 });
        encryptedKey = encryptImageKey(privateKey, context.business_id);
      } catch (error) { invalid(error); }
    }
    const values = { provider: input.provider, name: input.name, base_url: baseUrl, folder: input.folder, encrypted_key: encryptedKey };
    const result = source
      ? await client.database.from('menupro_image_sources').update(values).eq('id', source.id).select(columns).single()
      : await client.database.from('menupro_image_sources').insert([{ ...values, business_id: context.business_id }]).select(columns).single();
    check(result.error); return respond(result.data);
  }
  if (route === 'images/catalog' && method === 'GET') {
    if (!source || source.provider !== 'imagekit') throw new HttpError('Conecta ImageKit para explorar su biblioteca.');
    await enforceRequestLimit(request, 'imagekit_catalog', 120);
    const offset = z.coerce.number().int().min(0).max(100000).parse(new URL(request.url).searchParams.get('offset') ?? 0);
    const secret = await client.database.from('menupro_image_sources').select('encrypted_key').eq('id', source.id).single();
    check(secret.error);
    if (!secret.data?.encrypted_key) throw new HttpError('Vuelve a guardar la clave de ImageKit.');
    try { return respond(await listImageKit({ privateKey: decryptImageKey(secret.data.encrypted_key, context.business_id), baseUrl: source.base_url, folder: source.folder, offset })); }
    catch (error) { invalid(error); }
  }
  if (route === 'images/assets' && method === 'POST') {
    if (!source) throw new HttpError('Conecta primero tu servidor de imágenes.');
    const input = z.object({ url: z.string().max(2048), name: z.string().trim().min(1).max(255) }).strict().parse(await readJson(request));
    let url: string;
    try { url = imageWithinSource(input.url, source.base_url); } catch (error) { invalid(error); }
    const result = await client.database.rpc('menupro_register_image', { p_source_id: source.id, p_url: url, p_name: input.name });
    check(result.error); return respond(result.data, 201);
  }
  throw new HttpError('Ruta no encontrada.', 404);
}
