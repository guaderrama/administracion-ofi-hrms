import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, icon, actions }) => (
  <section className={`bg-white/30 backdrop-blur-lg rounded-card shadow-card border border-white/20 p-6 transition-shadow hover:shadow-card-hover ${className}`}>
    {(title || icon || actions) && (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon}
          {title && <h3 className="text-lg font-semibold text-slate-800">{title}</h3>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);
