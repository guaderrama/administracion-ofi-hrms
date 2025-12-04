import React, { useState } from 'react';
import { AdminLoginModal } from './checador/AdminLoginModal';
import { AdminView } from './checador/AdminView';

interface AdminPageProps {
  setView: (view: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ setView }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const handleLogin = (password: string) => {
        // Contraseña de administrador
        if (password === '110897') {
            setIsAuthenticated(true);
        } else {
            alert('Contraseña de administrador incorrecta.');
        }
    };

    const handleExit = () => {
        // Al salir del panel de admin, se cierra sesión y se vuelve al dashboard.
        setIsAuthenticated(false);
        setView('dashboard');
    };

    if (!isAuthenticated) {
        return (
            <AdminLoginModal
                onLogin={handleLogin}
                onClose={() => setView('dashboard')} // Si se cancela el login, volver al dashboard
            />
        );
    }

    return <AdminView onExit={handleExit} />;
};
