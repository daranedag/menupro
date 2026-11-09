import 'server-only';
import { cache } from 'react';
import pg, { type QueryConfig } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { auth } from './auth';
import { createDatabase } from '@/lib/neon-database.mjs';

type AppUser = { id: string; email: string; profile: { name: string }; emailVerified: boolean };
type NeonUser = NonNullable<NonNullable<Awaited<ReturnType<typeof auth.getSession>>['data']>['user']>;
let pool: pg.Pool;
function databasePool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete('sslmode'); url.searchParams.delete('channel_binding');
    pool = new pg.Pool({ connectionString: url.href, ssl: { rejectUnauthorized: true },
      max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000, allowExitOnIdle: true });
    pool.on('error', () => console.error('MenuPro: se cerró una conexión de base de datos.'));
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}

const currentUser = cache(async (): Promise<AppUser | null> => {
  const { data, error } = await auth.getSession();
  if (error) throw new Error('No se pudo verificar la sesión de Neon.');
  if (!data?.user) return null;
  return syncIdentity(data.user);
});

async function syncIdentity(user: NeonUser): Promise<AppUser> {
  // This identity comes exclusively from the verified, signed Neon session.
  const result = await databasePool().query<{ id: string }>(`INSERT INTO public.menupro_users(provider_id,email,email_verified,profile)
    VALUES($1,$2,$3,$4) ON CONFLICT(provider_id) DO UPDATE SET email=excluded.email,email_verified=excluded.email_verified,
    profile=excluded.profile,updated_at=now() RETURNING id`, [user.id,user.email,user.emailVerified,JSON.stringify({ name: user.name ?? '' })]);
  return { id: result.rows[0].id, email: user.email, emailVerified: user.emailVerified, profile: { name: user.name ?? '' } };
}

async function scopedQuery(user: AppUser | null, query: QueryConfig) {
  const connection = await databasePool().connect();
  try {
    await connection.query('BEGIN');
    await connection.query(user ? 'SET LOCAL ROLE menupro_authenticated' : 'SET LOCAL ROLE menupro_anon');
    await connection.query("SELECT set_config('menupro.user_id',$1,true)", [user?.id ?? '']);
    await connection.query("SET LOCAL statement_timeout='30s'");
    const result = await connection.query(query);
    await connection.query('COMMIT');
    return result;
  } catch (error) { await connection.query('ROLLBACK').catch(() => {}); throw error; }
  finally { connection.release(); }
}

function clientFor(user: AppUser | null) {
  const run = (query: QueryConfig) => scopedQuery(user,query);
  return {
    database: createDatabase(run),
    auth: { getCurrentUser: async () => ({ data: { user }, error: null }) },
    storage: {
      from(bucket: string) {
        if (bucket !== 'menupro_fiscal') throw new Error('Bucket no permitido.');
        return {
          async upload(key: string, blob: Blob) {
            const bytes = Buffer.from(await blob.arrayBuffer());
            const result = await createDatabase(run).from('menupro_storage_objects').insert([{ bucket,key,size: bytes.length,mime_type: blob.type,content: bytes }]);
            return { data: result.error ? null : { key, url: '/api/billing/documents' }, error: result.error };
          },
          async download(key: string) {
            const result = await createDatabase(run).from('menupro_storage_objects').select('content,mime_type').eq('bucket',bucket).eq('key',key).maybeSingle();
            return { data: result.data ? new Blob([result.data.content], { type: result.data.mime_type }) : null, error: result.error };
          },
          async remove(key: string) { return await createDatabase(run).from('menupro_storage_objects').delete().eq('bucket',bucket).eq('key',key); },
        };
      },
    },
  };
}
export function createPublicDatabase() { return clientFor(null); }
export async function createUserDatabase() { return clientFor(await currentUser()); }
// Only for a successful Neon SDK sign-in response. A new HttpOnly cookie is
// written to the response; it is not yet present in the incoming request headers.
export async function createSignedInDatabase(user: NeonUser) { return clientFor(await syncIdentity(user)); }
export async function getUser() { return currentUser(); }
