import React, { useState, useRef, useEffect } from 'react';

interface AdminLoginModalProps {
  onLogin: (password: string) => void;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ onLogin, onClose }) => {
  const [password, setPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-2xl p-8 max-w-sm w-full m-4">
        <h2 className="text-xl font-bold text-slate-800 text-center">Acceso de Administrador</h2>
        <p className="text-center text-slate-600 mt-1 mb-6">Por favor, ingrese la contraseña.</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full text-center text-lg bg-white/40 border border-slate-300 rounded-md p-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center py-2 px-4 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white/60 hover:bg-white/80"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!password}
              className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-amber-400 disabled:to-orange-400 disabled:cursor-not-allowed"
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};