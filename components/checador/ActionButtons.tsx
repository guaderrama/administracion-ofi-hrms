import React from 'react';
import { ClockStatus, LogType } from '../../types';
import { CheckIcon } from './icons/CheckIcon';
import { DoorIcon } from './icons/DoorIcon';
import { CoffeeIcon } from './icons/CoffeeIcon';

interface ActionButtonsProps {
  status: ClockStatus;
  onLog: (type: LogType) => void;
}

const ActionButton: React.FC<{ onClick: () => void; text: string; icon: React.ReactNode; className: string }> = ({ onClick, text, icon, className }) => (
    <button
        onClick={onClick}
        className={`flex-1 flex flex-col items-center justify-center p-6 text-white rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200 ${className}`}
    >
        {icon}
        <span className="mt-2 text-lg font-semibold">{text}</span>
    </button>
);

export const ActionButtons: React.FC<ActionButtonsProps> = ({ status, onLog }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {status === ClockStatus.OUT_OF_OFFICE && (
                <ActionButton onClick={() => onLog(LogType.ENTRADA)} text="Registrar Entrada" icon={<CheckIcon />} className="bg-gradient-to-br from-green-500 to-emerald-600" />
            )}
            
            {status === ClockStatus.WORKING && (
                <>
                    <ActionButton onClick={() => onLog(LogType.INICIO_COMIDA)} text="Iniciar Comida" icon={<CoffeeIcon />} className="bg-gradient-to-br from-sky-500 to-blue-600" />
                    <ActionButton onClick={() => onLog(LogType.SALIDA)} text="Registrar Salida" icon={<DoorIcon />} className="bg-gradient-to-br from-red-500 to-rose-600" />
                </>
            )}

            {status === ClockStatus.ON_LUNCH && (
                <ActionButton onClick={() => onLog(LogType.FIN_COMIDA)} text="Terminar Comida" icon={<CoffeeIcon />} className="bg-gradient-to-br from-amber-500 to-orange-600" />
            )}
        </div>
    );
};
