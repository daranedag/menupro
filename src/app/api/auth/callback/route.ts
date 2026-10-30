import { type NextRequest } from 'next/server';
import { createAuthActions } from '@insforge/sdk/ssr';
import { authRedirect, GOOGLE_VERIFIER_COOKIE } from '@/server/google-auth';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const providerError = params.get('error');
  if (providerError) {
    return authRedirect(request, providerError === 'access_denied'
      ? '/app/login?error=google_cancelled'
      : '/app/login?error=google_failed');
  }

  const code = params.get('insforge_code');
  const verifier = request.cookies.get(GOOGLE_VERIFIER_COOKIE)?.value;
  if (!code || code.length > 2048 || params.getAll('insforge_code').length !== 1) {
    return authRedirect(request, '/app/login?error=google_failed');
  }
  if (!verifier || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
    return authRedirect(request, '/app/login?error=google_session_expired');
  }

  try {
    const response = authRedirect(request, '/app/dashboard');
    const auth = createAuthActions({
      requestCookies: request.cookies,
      responseCookies: response.cookies,
    });
    const { data, error } = await auth.exchangeOAuthCode(code, verifier);
    if (error || !data?.user) return authRedirect(request, '/app/login?error=google_failed');
    return response;
  } catch {
    return authRedirect(request, '/app/login?error=google_failed');
  }
}
