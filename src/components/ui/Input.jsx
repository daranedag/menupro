'use client';
import { useId } from 'react';

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
  const generatedId = useId();
  const fieldId = props.id || name || generatedId;
  const descriptionId = `${fieldId}-description`;
  const baseStyles = 'ui-input px-4 py-2 border focus:ring-2 focus:ring-brand transition-colors bg-surface text-ink disabled:bg-canvas disabled:cursor-not-allowed';
  const errorStyles = error 
    ? 'border-red-500 focus:ring-red-500' 
    : 'border-line';
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium mb-2 text-ink">
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
          id={fieldId}
          aria-invalid={!!error || undefined}
          aria-describedby={error || helperText ? descriptionId : props['aria-describedby']}
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
        <p id={descriptionId} role="alert" className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p id={descriptionId} className="mt-1 text-sm text-muted">{helperText}</p>
      )}
    </div>
  );
}

export default Input;
