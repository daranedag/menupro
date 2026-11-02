// Shared validation only. Provider credentials and requests stay on the server.
export function publicImageUrl(value, base) {
  let url;
  try { url = new URL(value, base); } catch { throw new Error('Ingresa una dirección HTTPS válida.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search ||
      url.port || !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') ||
      host.endsWith('.internal') || host.endsWith('.test') || /^[\d.]+$/.test(host) || host.includes(':') ||
      url.href.length > 2048) {
    throw new Error('Usa una dirección HTTPS pública y permanente, sin claves ni parámetros.');
  }
  return url.href;
}

export function imageWithinSource(value, base) {
  const root = new URL(publicImageUrl(base));
  const image = new URL(publicImageUrl(value, root.href.endsWith('/') ? root.href : root.href + '/'));
  const prefix = root.pathname.endsWith('/') ? root.pathname : root.pathname + '/';
  if (image.origin !== root.origin || !image.pathname.startsWith(prefix) || image.pathname === prefix) {
    throw new Error('La imagen debe pertenecer al servidor y carpeta conectados.');
  }
  return image.href;
}
