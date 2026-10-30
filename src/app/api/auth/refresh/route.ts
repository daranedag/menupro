import { createRefreshAuthRouter } from '@insforge/sdk/ssr';
import { assertSameOrigin, fail } from '@/server/http';

const router = createRefreshAuthRouter();
export async function POST(request: Request) {
  try { assertSameOrigin(request); return await router.POST(request); }
  catch (error) { return fail(error); }
}
