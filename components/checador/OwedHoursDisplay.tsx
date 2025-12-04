import React from 'react';

interface OwedHoursDisplayProps {
  hours: number;
}

export const OwedHoursDisplay: React.FC<OwedHoursDisplayProps> = ({ hours }) => {
  return (
    <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded-r-lg shadow" role="alert">
      <p className="font-bold">Aviso Importante</p>
      <p>Tienes <span className="font-mono font-bold">{hours}</span> horas pendientes por reponer. Por favor, coordina con tu supervisor.</p>
    </div>
  );
};
