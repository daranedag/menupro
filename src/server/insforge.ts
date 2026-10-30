import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@insforge/sdk/ssr';
import { createClient } from '@insforge/sdk';

export function createPublicInsForge() {
  return createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!, isServerMode: true });
}

export async function createInsForge() {
  return createServerClient({ cookies: await cookies() });
}

export async function getUser() {
  const client = await createInsForge();
  const { data, error } = await client.auth.getCurrentUser();
  return error ? null : data?.user ?? null;
}
