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
    primary: 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-gray-500',
    success: 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-green-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-red-500',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus:ring-yellow-500',
    outline: 'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-100 hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5 active:scale-95 focus:ring-blue-500',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95 focus:ring-gray-500',
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
