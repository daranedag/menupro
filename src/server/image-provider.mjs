import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { imageWithinSource } from '../lib/image-library.mjs';

function key() {
  const value = process.env.MENUPRO_IMAGE_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('La conexión de ImageKit aún no está habilitada en MenuPro.');
  return Buffer.from(value, 'hex');
}

export function encryptImageKey(value, businessId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(businessId));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptImageKey(value, businessId) {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Vuelve a guardar la clave de ImageKit.');
  const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  cipher.setAAD(Buffer.from(businessId));
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([cipher.update(Buffer.from(encrypted, 'base64')), cipher.final()]).toString('utf8');
}

export async function listImageKit({ privateKey, baseUrl, folder = '/', offset = 0 }, fetcher = fetch) {
  const url = new URL('https://api.imagekit.io/v1/files');
  url.search = new URLSearchParams({ type: 'file', fileType: 'image', path: folder, limit: '48', skip: String(offset), sort: 'DESC_CREATED' }).toString();
  const response = await fetcher(url, { headers: { Authorization: 'Basic ' + Buffer.from(privateKey + ':').toString('base64') },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new Error('ImageKit rechazó la clave. Revisa su permiso de lectura de medios.');
    if (response.status === 429) throw new Error('ImageKit recibió demasiadas consultas. Espera un momento e inténtalo de nuevo.');
    throw new Error('No se pudo consultar ImageKit. Inténtalo de nuevo.');
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('ImageKit devolvió una respuesta inesperada.');
  const images = rows.filter(row => row.type === 'file' && row.fileType === 'image' && !row.isPrivateFile).flatMap(row => {
    try { return [{ externalId: row.fileId, name: String(row.name).slice(0, 255), url: imageWithinSource(row.url, baseUrl) }]; }
    catch { return []; }
  });
  return { images, nextOffset: rows.length === 48 ? offset + 48 : null };
}
