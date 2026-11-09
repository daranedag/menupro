import { auth } from '@/server/auth';
import { assertSameOrigin, fail, HttpError, respond } from '@/server/http';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { data, error } = await auth.getSession();
    if (error || !data?.user) throw new HttpError('Debes iniciar sesión.', 401);
    return respond({ refreshed: true });
  } catch (error) { return fail(error); }
}
