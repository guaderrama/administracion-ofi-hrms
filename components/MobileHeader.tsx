import React from 'react';

interface MobileHeaderProps {
  onMenuToggle: () => void;
  title?: string;
}

const MenuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onMenuToggle, title = 'Portal Interno' }) => {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#4A3728] text-white shadow-lg">
      <div className="flex items-center justify-between h-14 px-4">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-md hover:bg-amber-900/50 transition-colors"
          aria-label="Abrir menú"
        >
          <MenuIcon />
        </button>
        <h1 className="font-serif text-xl text-amber-50">{title}</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>
    </header>
  );
};
