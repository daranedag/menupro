import 'server-only';
import { createPublicDatabase } from './database';
import { launchAvailability } from '@/lib/commercial.mjs';

/** Fail closed if the backend is temporarily unavailable. */
export async function commercialSettings() {
  try {
    const { data, error } = await createPublicDatabase().database.from('menupro_commercial_settings')
      .select('grupo_enabled,annual_enabled').eq('id', true).single();
    if (error || !data) return { ...launchAvailability };
    return { grupo_enabled: data.grupo_enabled === true, annual_enabled: data.annual_enabled === true };
  } catch { return { ...launchAvailability }; }
}
