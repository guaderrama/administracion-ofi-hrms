import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

const STYLES: Record<BadgeVariant, string> = {
  success: 'bg-success-light text-success-dark',
  warning: 'bg-warning-light text-warning-dark',
  error: 'bg-error-light text-error-dark',
  info: 'bg-info-light text-info-dark',
  neutral: 'bg-slate-100 text-slate-600',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, children, size = 'sm' }) => (
  <span className={`inline-flex items-center rounded-badge font-medium ${STYLES[variant]} ${size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'}`}>
    {children}
  </span>
);
