'use client';
import { forwardRef } from 'react';

const Card = forwardRef(function Card({ 
  children, 
  title,
  subtitle,
  footer,
  hoverable = false,
  padding = 'md',
  className = '',
  ...props
}, ref) {
  
  const baseStyles = 'ui-card border border-line bg-surface text-ink';
  const hoverStyles = hoverable ? 'transition-colors hover:border-brand/40' : '';
  
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };
  
  return (
    <div {...props} ref={ref} className={`${baseStyles} ${hoverStyles} ${className}`}>
      {(title || subtitle) && (
        <div className={`ui-card-header ${paddings[padding]} border-b border-line`}>
          {title && <h3 className="ui-card-title text-ink">{title}</h3>}
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
