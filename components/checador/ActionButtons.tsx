import React from 'react';
import { ClockStatus, LogType } from '../../types';
import { CheckIcon } from './icons/CheckIcon';
import { DoorIcon } from './icons/DoorIcon';
import { CoffeeIcon } from './icons/CoffeeIcon';

interface ActionButtonsProps {
  status: ClockStatus;
  onLog: (type: LogType) => void;
  disabled?: boolean;
}

const ActionButton: React.FC<{ onClick: () => void; text: string; icon: React.ReactNode; className: string; disabled?: boolean }> = ({ onClick, text, icon, className, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex-1 flex flex-col items-center justify-center p-6 text-white rounded-lg shadow-lg transform transition-transform duration-200 ${disabled ? 'opacity-50 cursor-not-allowed scale-100' : 'hover:scale-105'} ${className}`}
    >
        {disabled ? (
            <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
        ) : icon}
        <span className="mt-2 text-lg font-semibold">{disabled ? 'Procesando...' : text}</span>
    </button>
);

export const ActionButtons: React.FC<ActionButtonsProps> = ({ status, onLog, disabled }) => {
    return (
        <div className="flex flex-col sm:flex-row gap-4">
            {status === ClockStatus.OUT_OF_OFFICE && (
                <ActionButton onClick={() => onLog(LogType.ENTRADA)} text="Registrar Entrada" icon={<CheckIcon />} className="bg-gradient-to-br from-green-500 to-emerald-600" disabled={disabled} />
            )}

            {status === ClockStatus.WORKING && (
                <>
                    <ActionButton onClick={() => onLog(LogType.INICIO_COMIDA)} text="Iniciar Comida" icon={<CoffeeIcon />} className="bg-gradient-to-br from-sky-500 to-blue-600" disabled={disabled} />
                    <ActionButton onClick={() => onLog(LogType.SALIDA)} text="Registrar Salida" icon={<DoorIcon />} className="bg-gradient-to-br from-red-500 to-rose-600" disabled={disabled} />
                </>
            )}

            {status === ClockStatus.ON_LUNCH && (
                <ActionButton onClick={() => onLog(LogType.FIN_COMIDA)} text="Terminar Comida" icon={<CoffeeIcon />} className="bg-gradient-to-br from-amber-500 to-orange-600" disabled={disabled} />
            )}
        </div>
    );
};
