'use client';

export default function DishStatusSelect({ value, onChange, label = 'Estado del plato', disabled = false }) {
  return <label className="flex min-w-0 flex-col gap-1 text-sm text-ink">
    <span className="sr-only">{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)} disabled={disabled}
      className="min-h-10 max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink disabled:opacity-50">
      <option value="available">Disponible</option>
      <option value="unavailable">No disponible</option>
      <option value="hidden">Oculto</option>
    </select>
  </label>;
}
