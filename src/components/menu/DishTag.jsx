export const dishTagColors = [
  { value: 'default', label: 'Gris', className: 'bg-slate-600 text-white' },
  { value: 'primary', label: 'Verde oscuro', className: 'bg-[#234d3c] text-white' },
  { value: 'success', label: 'Verde', className: 'bg-green-700 text-white' },
  { value: 'danger', label: 'Rojo', className: 'bg-red-700 text-white' },
  { value: 'warning', label: 'Amarillo', className: 'bg-yellow-300 text-yellow-950' },
  { value: 'info', label: 'Azul', className: 'bg-sky-700 text-white' },
];

export default function DishTag({ variant = 'default', children, className = '' }) {
  const color = dishTagColors.find(color => color.value === variant) || dishTagColors[0];
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold leading-relaxed ${color.className} ${className}`}>{children}</span>;
}
