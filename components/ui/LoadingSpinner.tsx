import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text, className = '' }) => {
  const sizes = { sm: 'w-5 h-5 border-2', md: 'w-8 h-8 border-4', lg: 'w-16 h-16 border-4' };
  return (
    <div className={`flex flex-col items-center justify-center ${className}`} role="status">
      <div className={`${sizes[size]} border-accent border-t-transparent rounded-full animate-spin`} />
      {text && <p className="mt-3 text-slate-500 text-sm">{text}</p>}
      <span className="sr-only">{text || 'Cargando...'}</span>
    </div>
  );
};
