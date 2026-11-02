'use client';
function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) {
  const baseStyles = 'ui-button inline-flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-action text-white hover:bg-action-hover',
    secondary: 'bg-elevated text-ink hover:bg-brand-soft',
    success: 'bg-green-700 text-white hover:bg-green-800',
    danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100',
    outline: 'bg-transparent border border-line text-ink hover:bg-brand-soft',
    ghost: 'bg-transparent text-muted hover:bg-canvas hover:text-ink',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button
      {...props}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
    >
      {children}
    </button>
  );
}

export default Button;
