import { type NextRequest } from 'next/server';
import { auth } from '@/server/auth';
import { appUrl } from '@/server/google-auth';
import { assertSameOrigin, fail, HttpError, respond } from '@/server/http';
import { enforceRequestLimit } from '@/server/security';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceRequestLimit(request, 'auth_google', 60);
    const { data, error } = await auth.signIn.social({
      provider: 'google',
      callbackURL: appUrl(request, '/app/dashboard').toString(),
      errorCallbackURL: appUrl(request, '/app/login?error=google_failed').toString(),
      disableRedirect: true,
    });

    if (error || !data?.url) {
      throw new HttpError('No se pudo iniciar el acceso con Google. Inténtalo nuevamente.', 503);
    }

    // The Neon SDK manages the OAuth verifier and HttpOnly cookies.
    return respond({ url: data.url });
  } catch (error) {
    return fail(error);
  }
}
