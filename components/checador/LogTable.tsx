import React from 'react';
import type { LogEntry } from '../../types';
import { LogType } from '../../types';
import { LocationMarkerIcon } from './icons/LocationMarkerIcon';
import { CheckIcon } from './icons/CheckIcon';
import { DoorIcon } from './icons/DoorIcon';
import { CoffeeIcon } from './icons/CoffeeIcon';

interface LogTableProps {
  logs: LogEntry[];
}

export const LogTable: React.FC<LogTableProps> = ({ logs }) => {
  const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);
  
  const renderLogType = (type: LogType) => {
    const iconProps = { className: "h-5 w-5 mr-2" };
    let icon;
    let textColor = "text-slate-700";

    switch (type) {
      case LogType.ENTRADA:
        icon = <CheckIcon {...iconProps} />;
        textColor = "text-green-700";
        break;
      case LogType.SALIDA:
        icon = <DoorIcon {...iconProps} />;
        textColor = "text-red-700";
        break;
      case LogType.INICIO_COMIDA:
        icon = <CoffeeIcon {...iconProps} />;
        textColor = "text-blue-700";
        break;
      case LogType.FIN_COMIDA:
        icon = <CoffeeIcon {...iconProps} />;
        textColor = "text-amber-700";
        break;
    }

    return (
      <div className={`flex items-center font-medium ${textColor}`}>
        {icon}
        <span>{type}</span>
      </div>
    );
  };

  const renderLocation = (log: LogEntry) => {
    if (!log.location) {
        return 'No disponible';
    }

    const isOffice = log.location.lat.toFixed(4) === '22.8984' && log.location.lon.toFixed(4) === '-109.9146';

    if (isOffice) {
        return <span className="font-semibold text-slate-800">Oficinas CSL</span>;
    }

    return (
      <div>
        <a href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lon}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-amber-600 hover:text-amber-800">
          <LocationMarkerIcon />
          <span className="ml-1">Ver mapa</span>
        </a>
        <span className="block text-xs text-slate-500 font-mono">{`Lat: ${log.location.lat.toFixed(4)}, Lon: ${log.location.lon.toFixed(4)}`}</span>
      </div>
    );
  };

  return (
    <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Mis registros de hoy</h3>
        <div className="overflow-x-auto bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 max-h-72 overflow-y-auto">
            <table className="min-w-full">
              <thead className="bg-white/80 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tipo</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Hora</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ubicación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {sortedLogs.length > 0 ? sortedLogs.map((log, index) => (
                  <tr key={index}>
                    <td className="py-3 px-4 whitespace-nowrap text-sm">{renderLogType(log.type)}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{new Date(log.timestamp).toLocaleTimeString('es-MX')}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">
                      {renderLocation(log)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                      <td colSpan={3} className="text-center py-4 text-sm text-slate-500">Aún no hay registros hoy.</td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
    </div>
  );
};