import React from 'react';
import { AdminView } from './checador/AdminView';
import { useAuth } from '../src/contexts/AuthContext';
import { AccessDenied } from './ui/AccessDenied';

interface AdminPageProps {
  setView: (view: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ setView }) => {
    const { isAdmin, user } = useAuth();

    const handleExit = () => {
        setView('dashboard');
    };

    if (!user) {
        return <AccessDenied icon="🔒" title="Acceso Restringido" message="Debes iniciar sesión para acceder a esta página." onBack={() => setView('dashboard')} />;
    }

    if (!isAdmin) {
        return <AccessDenied message="No tienes permisos de administrador para acceder a esta sección." onBack={() => setView('dashboard')} />;
    }

    return <AdminView onExit={handleExit} />;
};
