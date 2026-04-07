import React from 'react';
import type { LogEntry } from '../../types';
import { LogType } from '../../types';
import { LocationMarkerIcon } from './icons/LocationMarkerIcon';
import { CheckIcon } from './icons/CheckIcon';
import { DoorIcon } from './icons/DoorIcon';
import { CoffeeIcon } from './icons/CoffeeIcon';

interface AdminLogTableProps {
  logs: LogEntry[];
  getEffectiveScheduleTime: (employeeName: string, timestamp: number) => string;
  onEditLog?: (log: LogEntry) => void;
  onDeleteLog?: (log: LogEntry) => void;
  toleranceMinutes?: number;
}

export const AdminLogTable: React.FC<AdminLogTableProps> = ({ logs, getEffectiveScheduleTime, onEditLog, onDeleteLog, toleranceMinutes = 10 }) => {
  const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

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

  const renderIncident = (log: LogEntry) => {
    if (log.type !== LogType.ENTRADA) {
      return <span className="text-slate-400">-</span>;
    }

    const scheduleTime = getEffectiveScheduleTime(log.employeeName, log.timestamp);
    if (!scheduleTime) {
      return <span className="text-slate-400">-</span>;
    }

    const logDate = new Date(log.timestamp);
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    
    const scheduleDate = new Date(logDate);
    scheduleDate.setHours(hours, minutes, 0, 0);

    // 10 minutos de tolerancia (en milisegundos)
    const toleranceDeadline = new Date(scheduleDate.getTime() + toleranceMinutes * 60 * 1000);

    if (logDate > toleranceDeadline) {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
          Retardo
        </span>
      );
    }

    return <span className="text-slate-400">-</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white/60 rounded-lg shadow">
        <thead className="bg-white/80">
          <tr>
            {(onEditLog || onDeleteLog) && (
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
            )}
            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Colaborador</th>
            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tipo</th>
            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</th>
            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Hora</th>
            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Incidencia</th>
            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ubicación</th>
            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Coordenadas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {sortedLogs.length > 0 ? sortedLogs.map((log, index) => (
            <tr key={log.id || index} className="hover:bg-slate-100/50">
              {(onEditLog || onDeleteLog) && (
                <td className="py-3 px-4 whitespace-nowrap text-sm">
                  <div className="flex space-x-2">
                    {onEditLog && (
                      <button
                        onClick={() => onEditLog(log)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Editar registro"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {onDeleteLog && (
                      <button
                        onClick={() => onDeleteLog(log)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar registro"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              )}
              <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-800">{log.employeeName}</td>
              <td className="py-3 px-4 whitespace-nowrap text-sm">{renderLogType(log.type)}</td>
              <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{formatDate(log.timestamp)}</td>
              <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{formatTime(log.timestamp)}</td>
              <td className="py-3 px-4 whitespace-nowrap text-sm text-center">{renderIncident(log)}</td>
              <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">
                {log.location ? (
                  <a href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lon}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-amber-600 hover:text-amber-800">
                    <LocationMarkerIcon />
                    <span className="ml-1">Ver mapa</span>
                  </a>
                ) : 'N/A'}
              </td>
              <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                 {log.location ? `${log.location.lat.toFixed(4)}, ${log.location.lon.toFixed(4)}` : 'No disponible'}
              </td>
            </tr>
          )) : (
            <tr>
                <td colSpan={(onEditLog || onDeleteLog) ? 8 : 7} className="text-center py-4 text-sm text-slate-500">No hay registros en el rango de fechas seleccionado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
