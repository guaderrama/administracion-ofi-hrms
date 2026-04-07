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
import { NominasPage } from './components/NominasPage';
import { UserManagementPage } from './components/UserManagementPage';
import { LoginPage } from './components/auth/LoginPage';
import { useAuth } from './src/contexts/AuthContext';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

const App: React.FC = () => {
  const { user, loading, isAdmin, canViewAll, canEdit } = useAuth();
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

  // Proteger rutas - redirigir si no tiene permisos
  useEffect(() => {
    if (!loading && user && !canViewAll) {
      const restrictedRoutes = ['admin', 'requisitions', 'nominas', 'user-management'];
      if (restrictedRoutes.includes(currentView)) {
        setCurrentView('dashboard');
      }
    }
    // user-management solo para admin (supervisor no puede gestionar usuarios)
    if (!loading && user && !isAdmin && currentView === 'user-management') {
      setCurrentView('dashboard');
    }
  }, [currentView, isAdmin, canViewAll, loading, user]);

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
         // Admin y supervisor pueden ver requisiciones
        if (!canViewAll) return <DashboardPage />;
        return <RequisitionsPage />;
      case 'checador':
        return <ChecadorPage />;
      case 'admin':
        // Admin y supervisor pueden ver el panel
        if (!canViewAll) return <DashboardPage />;
        return <AdminPage setView={setCurrentView} />;
      case 'nominas':
        // Admin y supervisor pueden ver nominas
        if (!canViewAll) return <DashboardPage />;
        return <NominasPage setView={setCurrentView} />;
      case 'user-management':
        // Solo admin puede gestionar usuarios
        if (!isAdmin) return <DashboardPage />;
        return <UserManagementPage setView={setCurrentView} />;
      default:
        // Vista por defecto si ninguna coincide
        return <DashboardPage />;
    }
  };

  // Mostrar loading mientras se verifica autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <LoadingSpinner size="lg" text="Cargando..." className="text-white" />
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
        <main id="main-content" role="main" className="flex-1 overflow-x-hidden overflow-y-auto pt-14 lg:pt-0">
           <div className="page-enter">
             {renderView()}
           </div>
        </main>
      </div>
    </div>
  );
};

export default App;