import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';

export const GOOGLE_VERIFIER_COOKIE = 'menupro_google_verifier';
export const googleVerifierOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: 600,
};

export function appUrl(request: NextRequest, path: string) {
  return new URL(path, process.env.APP_URL || request.nextUrl.origin);
}

export function authRedirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(appUrl(request, path), 303);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.cookies.set(GOOGLE_VERIFIER_COOKIE, '', { ...googleVerifierOptions, maxAge: 0 });
  return response;
}
