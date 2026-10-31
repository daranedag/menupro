import { cookies } from 'next/headers';
import { z } from 'zod';
import { createPublicInsForge } from '@/server/insforge';
import { readJson } from '@/server/business';
import { assertSameOrigin, fail, HttpError, respond } from '@/server/http';
import { enforceRequestLimit } from '@/server/security';

const cookieName = 'menupro_password_reset';
const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/auth/password', maxAge: 600 };
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    assertSameOrigin(request);
    const { action } = await context.params;
    if (!['request', 'verify', 'confirm'].includes(action)) throw new HttpError('Ruta no encontrada.', 404);
    await enforceRequestLimit(request, 'password_' + action, action === 'request' ? 10 : 20);
    const jar = await cookies();
    const auth = createPublicInsForge().auth;
    if (action === 'request') {
      const { email } = z.object({ email: z.string().trim().email() }).strict().parse(await readJson(request));
      jar.set(cookieName, '', { ...options, maxAge: 0 });
      const result = await auth.sendResetPasswordEmail({ email, redirectTo: new URL('/app/recover', process.env.APP_URL || request.url).href });
      if (result.error && (result.error.statusCode ?? 0) >= 500) throw new HttpError('No se pudo solicitar el correo de recuperación. Inténtalo más tarde.', 503);
      return respond({ message: 'Si existe una cuenta con ese correo, recibirás las instrucciones para recuperar el acceso.' });
    }
    if (action === 'verify') {
      const input = z.object({ email: z.string().trim().email(), code: z.string().regex(/^\d{6}$/) }).strict().parse(await readJson(request));
      const { data, error } = await auth.exchangeResetPasswordToken(input);
      if (error || !data?.token) throw new HttpError('El código no es válido o ya venció. Solicita uno nuevo.');
      jar.set(cookieName, data.token, options); return respond({ verified: true });
    }
    const { password } = z.object({ password: z.string().min(8).max(128) }).strict().parse(await readJson(request));
    const otp = jar.get(cookieName)?.value;
    if (!otp) throw new HttpError('Verifica el código de tu correo antes de cambiar la contraseña.', 401);
    const { error } = await auth.resetPassword({ newPassword: password, otp });
    jar.set(cookieName, '', { ...options, maxAge: 0 });
    if (error) throw new HttpError('No se pudo cambiar la contraseña. Solicita un código nuevo.');
    return respond({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (error) { return fail(error); }
}
