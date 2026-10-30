'use client';
import { forwardRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Card = forwardRef(function Card({ 
  children, 
  title,
  subtitle,
  footer,
  hoverable = false,
  padding = 'md',
  className = ''
}, ref) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  
  const baseStyles = `rounded-lg shadow ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white'}`;
  const hoverStyles = hoverable ? 'hover:shadow-lg transition-shadow cursor-pointer' : '';
  
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };
  
  return (
    <div ref={ref} className={`${baseStyles} ${hoverStyles} ${className}`}>
      {(title || subtitle) && (
        <div className={`${paddings[padding]} border-b ${isDark ? 'border-gray-700' : ''}`}>
          {title && <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{title}</h3>}
          {subtitle && <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{subtitle}</p>}
        </div>
      )}
      
      <div className={paddings[padding]}>
        {children}
      </div>
      
      {footer && (
        <div className={`${paddings[padding]} border-t rounded-b-lg ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
          {footer}
        </div>
      )}
    </div>
  );
});

export default Card;
