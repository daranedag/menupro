'use client';
import { useTheme } from '../../contexts/ThemeContext';

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
  forceLight = false,
  ...props
}) {
  const { theme } = useTheme();
  const systemPrefersDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  // Respeta la preferencia explícita del tema; solo usa la clase global si no hay modo definido.
  const isDark = !forceLight && (theme.mode === 'dark' || (!theme.mode && systemPrefersDark));
  
  const baseStyles = `px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:cursor-not-allowed ${
    isDark 
      ? 'bg-gray-700 text-white placeholder-gray-400 disabled:bg-gray-800' 
      : 'bg-white text-gray-900 placeholder-gray-500 disabled:bg-gray-100'
  }`;
  const errorStyles = error 
    ? 'border-red-500 focus:ring-red-500' 
    : isDark ? 'border-gray-600' : 'border-gray-300';
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label htmlFor={name} className={`block text-sm font-semibold mb-2 tracking-tight ${isDark ? 'text-gray-100' : 'text-slate-800'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>
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
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{helperText}</p>
      )}
    </div>
  );
}

export default Input;
