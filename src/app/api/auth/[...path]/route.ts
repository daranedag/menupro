import { auth } from '@/server/auth';
import { handleApi } from '@/server/api';

// Keep the existing MenuPro API contract alongside the SDK's OAuth/session
// proxy. The SDK must receive the remainder of /api/auth as `path`.
const neon = auth.handler();
const appRoutes = new Set(['login','register','verify','logout','session','profile','restaurant']);
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  if (appRoutes.has(path[0])) return handleApi(request, { params: Promise.resolve({ path: ['auth', ...path] }) });
  return neon[request.method as keyof typeof neon](request, context);
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE, handle as PATCH };
