'use client';

function Input({ 
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  icon,
  className = '',
  ...props
}) {
  const baseStyles = 'px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors bg-surface text-ink placeholder-muted disabled:bg-canvas disabled:cursor-not-allowed';
  const errorStyles = error 
    ? 'border-red-500 focus:ring-red-500' 
    : 'border-line';
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label htmlFor={name} className="block text-sm font-semibold mb-2 tracking-tight text-ink">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
            {icon}
          </div>
        )}
        
        <input
          {...props}
          id={name}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`${baseStyles} ${errorStyles} ${widthClass} ${icon ? 'pl-10' : ''}`}
        />
      </div>
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="mt-1 text-sm text-muted">{helperText}</p>
      )}
    </div>
  );
}

export default Input;
