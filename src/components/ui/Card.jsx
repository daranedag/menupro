'use client';
import { forwardRef } from 'react';

const Card = forwardRef(function Card({ 
  children, 
  title,
  subtitle,
  footer,
  hoverable = false,
  padding = 'md',
  className = ''
}, ref) {
  
  const baseStyles = 'rounded-xl border border-line bg-surface text-ink shadow-sm';
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
        <div className={`${paddings[padding]} border-b border-line`}>
          {title && <h3 className="text-xl font-semibold text-ink">{title}</h3>}
          {subtitle && <p className="text-sm mt-1 text-muted">{subtitle}</p>}
        </div>
      )}
      
      <div className={paddings[padding]}>
        {children}
      </div>
      
      {footer && (
        <div className={`${paddings[padding]} border-t rounded-b-lg bg-canvas border-line`}>
          {footer}
        </div>
      )}
    </div>
  );
});

export default Card;
