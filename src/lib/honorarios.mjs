// SII: commercial year of the service payment (Chile), not the UTC year.
export function honorariumRate(date = new Date()) {
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Santiago' }).format(new Date(date)));
  if (!Number.isFinite(year) || year < 2025) throw new Error('Fecha tributaria no admitida.');
  return year >= 2028 ? .17 : year === 2027 ? .16 : year === 2026 ? .1525 : .145;
}
export function honorariumAmounts(gross, party, date) {
  if (!Number.isSafeInteger(gross) || gross < 1 || !['recipient', 'emitter'].includes(party)) throw new Error('Honorario inválido.');
  const rate = honorariumRate(date);
  const withheld = party === 'recipient' ? Math.round(gross * rate) : 0;
  return { honorarium_gross: gross, retention_rate: rate, withholding_amount: withheld, gross_amount: gross - withheld };
}
export function validRut(input) {
  const value = String(input).replace(/[.\s-]/g, '').toUpperCase();
  if (!/^[1-9]\d{6,7}[\dK]$/.test(value)) return false;
  let sum = 0; let factor = 2;
  for (const digit of value.slice(0, -1).split('').reverse()) { sum += Number(digit) * factor; factor = factor === 7 ? 2 : factor + 1; }
  return '0123456789K0'[11 - sum % 11] === value.at(-1);
}
