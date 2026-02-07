import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="text-center py-12 px-4">
    {icon && <div className="mx-auto mb-4 text-slate-300">{icon}</div>}
    <h4 className="text-sm font-semibold text-slate-600">{title}</h4>
    {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
    {action && (
      <button
        onClick={action.onClick}
        className="mt-4 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-accent-light to-accent rounded-button hover:from-accent hover:to-accent-dark transition-all"
      >
        {action.label}
      </button>
    )}
  </div>
);
