import React from 'react';
import { CurrentTime } from './CurrentTime';

export const Header: React.FC = () => {
    return (
        <header className="flex justify-between items-start mb-8 border-b pb-4 border-slate-300/80">
            <div>
                <h1 className="font-serif text-4xl font-bold text-slate-900">Registro de Asistencia</h1>
                <p className="mt-2 text-lg text-slate-700">IVAN GUADERRAMA ART</p>
            </div>
            <CurrentTime />
        </header>
    );
};