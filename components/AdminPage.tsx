import React from 'react';
import { AdminView } from './checador/AdminView';
import { useAuth } from '../src/contexts/AuthContext';

interface AdminPageProps {
  setView: (view: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ setView }) => {
    const { isAdmin, user } = useAuth();

    const handleExit = () => {
        setView('dashboard');
    };

    // SECURITY: Use Firebase Auth role instead of hardcoded password
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Acceso Restringido</h2>
                    <p className="text-slate-600 mb-6">Debes iniciar sesión para acceder a esta página.</p>
                    <button
                        onClick={() => setView('dashboard')}
                        className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Acceso Denegado</h2>
                    <p className="text-slate-600 mb-6">No tienes permisos de administrador para acceder a esta sección.</p>
                    <button
                        onClick={() => setView('dashboard')}
                        className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    return <AdminView onExit={handleExit} />;
};
