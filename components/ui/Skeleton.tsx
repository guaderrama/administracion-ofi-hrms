import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-bg rounded ${className}`} aria-hidden="true" />
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-3 p-4" role="status" aria-label="Cargando datos...">
    <div className="flex gap-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-3 flex-1" />
        ))}
      </div>
    ))}
    <span className="sr-only">Cargando...</span>
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="bg-white/30 backdrop-blur-lg rounded-card shadow-card border border-white/20 p-6 space-y-4" role="status" aria-label="Cargando...">
    <div className="flex items-center space-x-4">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-5 w-40" />
    </div>
    <div className="space-y-2 pl-12">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
    {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
  </div>
);
