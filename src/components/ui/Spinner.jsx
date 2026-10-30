'use client';
function Spinner({ size = 'md', label = '' }) {
  const sizes = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className="flex items-center justify-center gap-3">
      <div
        className={`${sizes[size] || sizes.md} border-gray-200 border-t-blue-600 rounded-full animate-spin`}
        aria-label={label || 'Cargando'}
      />
      {label && <span className="text-sm text-gray-600">{label}</span>}
    </div>
  );
}

export default Spinner;
