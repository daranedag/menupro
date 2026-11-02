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
  const baseStyles = 'font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-action text-white hover:bg-action-hover hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-brand',
    secondary: 'bg-elevated text-ink hover:bg-brand-soft hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-brand',
    success: 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-green-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-red-500',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-yellow-500',
    outline: 'bg-transparent border-2 border-brand text-brand hover:bg-brand-soft hover:border-brand hover:shadow-md hover:-translate-y-0.5 active:scale-95 focus:ring-brand',
    ghost: 'bg-transparent text-ink hover:bg-canvas hover:shadow-md hover:-translate-y-0.5 active:scale-95 focus:ring-gray-500',
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
