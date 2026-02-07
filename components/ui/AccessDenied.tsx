import React from 'react';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  icon?: string;
  onBack: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  title = 'Acceso Denegado',
  message = 'No tienes permisos para acceder a esta seccion.',
  icon = '⚠️',
  onBack,
}) => (
  <div className="flex items-center justify-center min-h-screen" role="alert">
    <div className="bg-white/30 backdrop-blur-lg rounded-card shadow-card border border-white/20 p-8 text-center max-w-md animate-fade-in">
      <div className="text-5xl mb-4">{icon}</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
      <p className="text-slate-600 mb-6">{message}</p>
      <button
        onClick={onBack}
        className="px-6 py-2 bg-gradient-to-r from-accent-light to-accent text-white rounded-button font-medium hover:from-accent hover:to-accent-dark transition-all active:scale-[0.98]"
      >
        Volver al Inicio
      </button>
    </div>
  </div>
);
