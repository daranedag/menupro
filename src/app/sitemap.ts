import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.APP_URL || 'http://localhost:3000';
  return ['', '/precios', '/quienes-somos', '/contacto', '/privacidad', '/terminos', '/menu-digital-restaurantes', '/menu-digital-restaurantes-santiago', '/menu-digital-restaurantes-valdivia'].map(path => ({ url: new URL(path, origin).href }));
}
