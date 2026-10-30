import { cookies } from 'next/headers';
import { type NextRequest } from 'next/server';
import { createAuthActions } from '@insforge/sdk/ssr';
import { appUrl, GOOGLE_VERIFIER_COOKIE, googleVerifierOptions } from '@/server/google-auth';
import { assertSameOrigin, fail, HttpError, respond } from '@/server/http';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const auth = createAuthActions({ cookies: cookieStore });
    const { data, error } = await auth.signInWithOAuth('google', {
      redirectTo: appUrl(request, '/api/auth/callback').toString(),
      additionalParams: { prompt: 'select_account' },
      skipBrowserRedirect: true,
    });

    if (error || !data.url || !data.codeVerifier) {
      throw new HttpError('No se pudo iniciar el acceso con Google. Inténtalo nuevamente.', 503);
    }

    cookieStore.set(GOOGLE_VERIFIER_COOKIE, data.codeVerifier, googleVerifierOptions);
    // Only the authorization URL reaches the browser; PKCE stays in an HttpOnly cookie.
    return respond({ url: data.url });
  } catch (error) {
    return fail(error);
  }
}
