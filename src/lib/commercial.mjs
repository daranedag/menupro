/** Local mensual is always available; other new sales require explicit switches. */
export const launchAvailability = Object.freeze({ grupo_enabled: false, annual_enabled: false });
export function planAvailable(planId, cycle, settings = launchAvailability) {
  return ['local', 'grupo'].includes(planId) && ['monthly', 'annual'].includes(cycle)
    && (planId !== 'grupo' || settings.grupo_enabled === true)
    && (cycle !== 'annual' || settings.annual_enabled === true);
}
