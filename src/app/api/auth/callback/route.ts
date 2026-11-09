import { type NextRequest } from 'next/server';
import { authRedirect } from '@/server/google-auth';

// Old InsForge links cannot be exchanged with Neon. New OAuth flows return to
// /app/dashboard, where Neon's middleware completes the verifier exchange.
export async function GET(request: NextRequest) {
  return authRedirect(request, '/app/login?error=google_session_expired');
}
