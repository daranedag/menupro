'use client';
function Badge({ 
  children, 
  variant = 'default',
  size = 'md',
  rounded = false,
  className = ''
}) {
  const baseStyles = 'inline-flex items-center font-medium';
  
  const variants = {
    default: 'bg-canvas text-ink',
    primary: 'bg-brand-soft text-brand',
    success: 'bg-green-100 text-green-800',
    danger: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-cyan-100 text-cyan-800',
    discount: 'bg-amber-100 text-amber-900',
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };
  
  const roundedClass = rounded ? 'rounded-full' : 'rounded';
  
  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${roundedClass} ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
