import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export function adaptInsForgeSql(sql) {
  return sql.replace(/\bauth\.users\b/g, 'public.menupro_users')
    .replace(/\bauth\.uid\(\)/g, 'public.menupro_auth_uid()')
    .replace(/\bstorage\.objects\b/g, 'public.menupro_storage_objects')
    .replace(/\banon\b/g, 'menupro_anon')
    .replace(/\bauthenticated\b/g, 'menupro_authenticated');
}

export function connectionConfig(connectionString) {
  if (!connectionString) throw new Error('Falta DATABASE_URL_UNPOOLED.');
  const url = new URL(connectionString);
  if (!url.hostname.endsWith('.neon.tech')) throw new Error('La migración requiere una conexión de Neon.');
  if (url.hostname.includes('-pooler.')) throw new Error('Usa la conexión directa DATABASE_URL_UNPOOLED para migrar.');
  // Preserve certificate validation rather than pg's legacy sslmode=require.
  url.searchParams.delete('sslmode');
  url.searchParams.delete('channel_binding');
  return { connectionString: url.href, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000 };
}

export async function migrationSources() {
  const root = new URL('../migrations/', import.meta.url);
  const paths = ['neon/00000000000000_menupro-neon-platform.sql',
    ...(await readdir(root)).filter(name => /^\d+.*\.sql$/.test(name)).sort(),
    ...(await readdir(new URL('neon/', root))).filter(name => name !== '00000000000000_menupro-neon-platform.sql' && name.endsWith('.sql')).sort().map(name => 'neon/' + name)];
  return Promise.all(paths.map(async name => {
    const source = await readFile(new URL(name, root), 'utf8');
    const sql = name.startsWith('neon/') ? source : adaptInsForgeSql(source);
    if (/\b(?:auth|storage|system|schedules|realtime)\./.test(sql.replace(/^\s*--.*$/gm, ''))) throw new Error('Dependencia de InsForge sin adaptar: ' + name);
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}

export async function migrate({ status = false } = {}) {
  const client = new pg.Client(connectionConfig(process.env.DATABASE_URL_UNPOOLED));
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('menupro_migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS public.menupro_schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = new Map((await client.query('SELECT name,checksum FROM public.menupro_schema_migrations')).rows.map(row => [row.name,row.checksum]));
    for (const source of await migrationSources()) {
      if (applied.has(source.name)) {
        if (applied.get(source.name) !== source.checksum) throw new Error('Migración aplicada modificada: ' + source.name);
        if (status) console.log('applied ' + source.name);
        continue;
      }
      if (status) { console.log('pending ' + source.name); continue; }
      try { await client.query(source.sql); } catch (error) { throw new Error(source.name + ': ' + error.message, { cause: error }); }
      await client.query('INSERT INTO public.menupro_schema_migrations(name,checksum) VALUES($1,$2)', [source.name,source.checksum]);
      console.log('applied ' + source.name);
    }
    if (!status && process.env.MENUPRO_WORKER_SECRET) {
      if (process.env.MENUPRO_WORKER_SECRET.length < 40) throw new Error('MENUPRO_WORKER_SECRET debe tener al menos 40 caracteres.');
      await client.query("INSERT INTO public.menupro_system_keys(name,secret_hash) VALUES('worker',$1) ON CONFLICT(name) DO UPDATE SET secret_hash=excluded.secret_hash", [createHash('sha256').update(process.env.MENUPRO_WORKER_SECRET).digest('hex')]);
    }
    await client.query(status ? 'ROLLBACK' : 'COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file:///' + process.argv[1].replaceAll('\\','/')))) {
  migrate({ status: process.argv.includes('--status') }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
