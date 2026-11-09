import { auth } from '@/server/auth';

export default auth.middleware({ loginUrl: '/app/login', publicRoutes: ['/app/login','/app/recover'] });
export const config = { matcher: ['/app/:path*'] };
