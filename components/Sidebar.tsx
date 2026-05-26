import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { menuConfigService, type MenuConfig, type MenuOptionConfig } from '../src/services/firestoreService';

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

const CurrencyIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
);

const UsersIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
);


interface SidebarProps {
  setView: (view: string) => void;
  currentView: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const CloseIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const Sidebar: React.FC<SidebarProps> = ({ setView, currentView, isOpen = true, onClose }) => {
  const [openSection, setOpenSection] = useState<string>('checador');
  const { isAdmin, canViewAll, canEdit, userData, logout } = useAuth();
  const [menuConfig, setMenuConfig] = useState<MenuConfig | null>(null);

  // Cargar configuración del menú desde Firestore
  useEffect(() => {
    const unsubscribe = menuConfigService.subscribe((config) => {
      setMenuConfig(config);
    });
    return () => unsubscribe();
  }, []);

  // Toggle de opción del menú (solo admin)
  const handleToggleOption = async (optionId: string, currentEnabled: boolean) => {
    try {
      await menuConfigService.toggleOption(optionId, !currentEnabled);
    } catch (error) {
      console.error('Error al cambiar configuración:', error);
    }
  };

  // Filtrar opciones según rol: admin/supervisor ve todo, empleados solo las habilitadas
  const getVisibleOptions = (): MenuOptionConfig[] => {
    if (!menuConfig) return [];
    if (canViewAll) return menuConfig.options;
    return menuConfig.options.filter(opt => opt.enabled);
  };

  const handleNavigation = (view: string) => {
    setView(view);
    // Cerrar sidebar en móvil después de navegar
    if (onClose && window.innerWidth < 1024) {
      onClose();
    }
  };

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
        onClick={(e) => { e.preventDefault(); handleNavigation(view); }}
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
                aria-expanded={isOpen}
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
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        flex-shrink-0 w-64 bg-brand-900 text-white flex flex-col shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} aria-label="Navegación principal">
        <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 border-b border-amber-900/50">
          <h1 className="font-serif text-2xl text-amber-50">Portal Interno</h1>
          {/* Botón cerrar solo en móvil */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-amber-900/50 transition-colors"
            aria-label="Cerrar menú"
          >
            <CloseIcon />
          </button>
        </div>

      {/* Info del usuario */}
      <div className="px-4 py-3 border-b border-amber-900/50">
        <p className="text-amber-100 text-sm truncate">{userData?.email}</p>
        <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
          isAdmin ? 'bg-amber-600 text-white'
            : userData?.role === 'supervisor' ? 'bg-purple-600 text-white'
            : 'bg-amber-900/50 text-amber-200'
        }`}>
          {isAdmin ? 'Administrador' : userData?.role === 'supervisor' ? 'Supervisor' : 'Empleado'}
        </span>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto justify-between">
        <nav className="px-2 py-4 space-y-4">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); handleNavigation('dashboard'); }}
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
            {getVisibleOptions().map((option) => (
              <li key={option.id} className="mt-1 flex items-center">
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleNavigation(option.view); }}
                  className={`flex-1 group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                    currentView === option.view
                      ? 'bg-amber-800 text-white'
                      : option.enabled || canViewAll
                        ? 'text-amber-100 hover:bg-amber-900/50 hover:text-white'
                        : 'text-amber-100/50'
                  } ${!option.enabled && canViewAll ? 'opacity-50' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-3 ${option.enabled ? 'bg-current' : 'bg-red-400'}`}></span>
                  <span>{option.label}</span>
                </a>
                {/* Toggle solo visible para admin (no supervisor) */}
                {canEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleOption(option.id, option.enabled); }}
                    className={`ml-2 px-2 py-1 rounded text-xs font-bold transition-all shadow-sm ${
                      option.enabled
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                    title={option.enabled ? 'Click para OCULTAR a empleados' : 'Click para MOSTRAR a empleados'}
                  >
                    {option.enabled ? 'ON' : 'OFF'}
                  </button>
                )}
              </li>
            ))}
            {getVisibleOptions().length === 0 && !canViewAll && (
              <li className="mt-1 px-3 py-2 text-sm text-amber-100/50 italic">
                No hay opciones disponibles
              </li>
            )}
          </Section>

          {/* Mostrar Requisiciones para Admin y Supervisor */}
          {canViewAll && (
            <Section sectionKey="requisitions" title="Requisiciones" icon={<DocumentTextIcon />}>
                <li className="mt-1">
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); handleNavigation('requisitions'); }}
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
            {/* Mostrar Administrador para Admin y Supervisor */}
            {canViewAll && (
              <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleNavigation('admin'); }}
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

            {/* Mostrar Nominas para Admin y Supervisor */}
            {canViewAll && (
              <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleNavigation('nominas'); }}
                  className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                  currentView === 'nominas'
                      ? 'bg-amber-800 text-white'
                      : 'text-amber-100 hover:bg-amber-900/50 hover:text-white'
                  }`}
              >
                  <CurrencyIcon className="mr-3" />
                  Nominas
              </a>
            )}

            {/* Comisiones - Admin y Supervisor */}
            {canViewAll && (
              <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleNavigation('comisiones'); }}
                  className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                  currentView === 'comisiones'
                      ? 'bg-amber-800 text-white'
                      : 'text-amber-100 hover:bg-amber-900/50 hover:text-white'
                  }`}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                  Comisiones
              </a>
            )}

            {/* Calendario - Admin y Supervisor */}
            {canViewAll && (
              <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleNavigation('calendar'); }}
                  className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                  currentView === 'calendar'
                      ? 'bg-amber-800 text-white'
                      : 'text-amber-100 hover:bg-amber-900/50 hover:text-white'
                  }`}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 14.25h.008v.008H12v-.008z" />
                  </svg>
                  Calendario
              </a>
            )}

            {/* Solo mostrar Gestión de Usuarios para Admin */}
            {isAdmin && (
              <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleNavigation('user-management'); }}
                  className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                  currentView === 'user-management'
                      ? 'bg-amber-800 text-white'
                      : 'text-amber-100 hover:bg-amber-900/50 hover:text-white'
                  }`}
              >
                  <UsersIcon className="mr-3" />
                  Gestion de Usuarios
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
    </aside>
    </>
  );
};
