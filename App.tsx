import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileHeader } from './components/MobileHeader';
import { PermissionGeneratorPage } from './components/PermissionGeneratorPage';
import { RequisitionsPage } from './components/RequisitionsPage';
import { VacationSlipPage } from './components/VacationSlipPage';
import { LoanRequestPage } from './components/LoanRequestPage';
import { ChecadorPage } from './components/checador/ChecadorPage';
import { DashboardPage } from './components/DashboardPage';
import { AdminPage } from './components/AdminPage';
import { LoginPage } from './components/auth/LoginPage';
import { useAuth } from './src/contexts/AuthContext';

const App: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Cerrar sidebar cuando cambia el tamaño de pantalla a desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Proteger rutas de admin - redirigir si no es admin
  useEffect(() => {
    if (!loading && user && !isAdmin) {
      const adminOnlyRoutes = ['admin', 'requisitions'];
      if (adminOnlyRoutes.includes(currentView)) {
        setCurrentView('dashboard');
      }
    }
  }, [currentView, isAdmin, loading, user]);

  const renderView = () => {
    // Enrutamiento simple basado en el string de la vista
    const [mainView] = currentView.split('/');
    
    switch (mainView) {
      case 'dashboard':
        return <DashboardPage />;
      case 'rh':
        if (currentView === 'rh/permission-generator') {
            return <PermissionGeneratorPage />;
        }
        if (currentView === 'rh/vacation-slip') {
            return <VacationSlipPage />;
        }
        if (currentView === 'rh/loan-request') {
            return <LoanRequestPage />;
        }
        // Futuras vistas de RH podrían ir aquí
        return <div className="p-8 text-center"><p>Seleccione una herramienta de Recursos Humanos.</p></div>;
      case 'requisitions':
         // Solo admin puede ver requisiciones
        if (!isAdmin) return <DashboardPage />;
        return <RequisitionsPage />;
      case 'checador':
        return <ChecadorPage />;
      case 'admin':
        // Solo admin puede ver el panel de administrador
        if (!isAdmin) return <DashboardPage />;
        return <AdminPage setView={setCurrentView} />;
      default:
        // Vista por defecto si ninguna coincide
        return <DashboardPage />;
    }
  };

  // Mostrar loading mientras se verifica autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Mostrar login si no hay usuario autenticado
  if (!user) {
    return <LoginPage />;
  }

  // Usuario autenticado - mostrar app normal
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Header móvil */}
      <MobileHeader onMenuToggle={() => setIsSidebarOpen(true)} />

      {/* Sidebar responsive */}
      <Sidebar
        setView={setCurrentView}
        currentView={currentView}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto pt-14 lg:pt-0">
           {/* El fondo degradado se aplica desde el body, así que se verá aquí */}
           {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;