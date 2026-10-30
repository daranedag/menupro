import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/app/', '/api/'] }, sitemap: new URL('/sitemap.xml', process.env.APP_URL || 'http://localhost:3000').href };
}
