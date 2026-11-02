'use client';
function Spinner({ size = 'md', label = '' }) {
  const sizes = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div role="status" className="flex items-center justify-center gap-3">
      <div
        className={`${sizes[size] || sizes.md} border-line border-t-brand rounded-full animate-spin`}
        aria-hidden="true"
      />
      <span className={label ? 'text-sm text-muted' : 'sr-only'}>{label || 'Cargando'}</span>
    </div>
  );
}

export default Spinner;
