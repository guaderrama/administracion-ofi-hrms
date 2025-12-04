import React, { useState } from 'react';
import { useAuth } from '../src/contexts/AuthContext';

// Componentes de íconos definidos localmente para simplicidad y sin dependencias externas
const HomeIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
);

const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const DocumentTextIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const CollectionIcon: React.FC<{className?: string}> = ({ className }) => (
     <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
);

const ClockIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const ShieldCheckIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z" />
    </svg>
);

const LogoutIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);


interface SidebarProps {
  setView: (view: string) => void;
  currentView: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ setView, currentView }) => {
  const [openSection, setOpenSection] = useState<string>('checador');
  const { isAdmin, userData, logout } = useAuth();

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? '' : section);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const NavLink: React.FC<{ view: string; label: string; }> = ({ view, label }) => (
    <li className="mt-1">
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); setView(view); }}
        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
          currentView === view
            ? 'bg-amber-800 text-white'
            : 'text-amber-100 hover:bg-amber-900/50 hover:text-white'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-3"></span>
        <span>{label}</span>
      </a>
    </li>
  );

  const Section: React.FC<{ sectionKey: string; title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ sectionKey, title, icon, children }) => {
     const isOpen = openSection === sectionKey;
     return (
        <div>
            <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full group flex items-center px-2 py-2 text-left text-base font-medium rounded-md text-amber-100 hover:bg-amber-900/50 hover:text-white focus:outline-none transition-colors duration-150"
            >
                {icon}
                <span className="ml-3 flex-1">{title}</span>
                <ChevronDownIcon className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="mt-1 space-y-1 pl-5 animate-fade-in-down">
                    {children}
                </div>
            )}
        </div>
     );
  };


  return (
    <div className="flex-shrink-0 w-64 bg-[#4A3728] text-white flex flex-col shadow-2xl z-10">
      <div className="flex items-center justify-center h-16 flex-shrink-0 px-4 border-b border-amber-900/50">
        <h1 className="font-serif text-2xl text-amber-50">Portal Interno</h1>
      </div>

      {/* Info del usuario */}
      <div className="px-4 py-3 border-b border-amber-900/50">
        <p className="text-amber-100 text-sm truncate">{userData?.email}</p>
        <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
          isAdmin ? 'bg-amber-600 text-white' : 'bg-amber-900/50 text-amber-200'
        }`}>
          {isAdmin ? 'Administrador' : 'Empleado'}
        </span>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto justify-between">
        <nav className="px-2 py-4 space-y-4">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setView('dashboard'); }}
            className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
              currentView === 'dashboard'
                ? 'bg-amber-800 text-white'
                : 'text-amber-100 hover:bg-amber-900/50 hover:text-white'
            }`}
          >
            <HomeIcon className="mr-3" />
            Inicio
          </a>

          <Section sectionKey="checador" title="Checador" icon={<ClockIcon />}>
            <NavLink
              view="checador"
              label="Registro de Asistencia"
            />
          </Section>

          <Section sectionKey="rh" title="Recursos Humanos" icon={<CollectionIcon />}>
             <NavLink
                view="rh/permission-generator"
                label="Permiso Laboral"
              />
              <NavLink
                view="rh/vacation-slip"
                label="Papeleta de vacaciones"
              />
              <NavLink
                view="rh/loan-request"
                label="Solicitud de Préstamo"
              />
          </Section>

          {/* Solo mostrar Requisiciones para Admin */}
          {isAdmin && (
            <Section sectionKey="requisitions" title="Requisiciones" icon={<DocumentTextIcon />}>
                <li className="mt-1">
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setView('requisitions'); }}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                      currentView === 'requisitions'
                        ? 'bg-amber-800 text-white'
                        : 'text-amber-100 hover:bg-amber-900/50 hover:text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current mr-3"></span>
                    <span>Próximamente...</span>
                  </a>
                </li>
            </Section>
          )}
        </nav>

        <div className="px-2 py-4 border-t border-amber-900/50 space-y-2">
            {/* Solo mostrar Administrador para Admin */}
            {isAdmin && (
              <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setView('admin'); }}
                  className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                  currentView === 'admin'
                      ? 'bg-amber-800 text-white'
                      : 'text-amber-100 hover:bg-amber-900/50 hover:text-white'
                  }`}
              >
                  <ShieldCheckIcon className="mr-3" />
                  Administrador
              </a>
            )}

            {/* Botón de cerrar sesión */}
            <button
                onClick={handleLogout}
                className="w-full group flex items-center px-2 py-2 text-base font-medium rounded-md text-amber-100 hover:bg-red-900/50 hover:text-white transition-colors duration-150"
            >
                <LogoutIcon className="mr-3" />
                Cerrar Sesión
            </button>
        </div>
      </div>
    </div>
  );
};
