import React, { useMemo } from 'react';
import type { LogEntry } from '../../types';
import { IncidentType, LogType } from '../../types';

interface IncidentsReportProps {
  logs: LogEntry[];
  getEffectiveScheduleTime: (employeeName: string, timestamp: number) => string;
}

interface Incident {
    employeeName: string;
    date: string;
    type: IncidentType;
    details: string;
}

export const IncidentsReport: React.FC<IncidentsReportProps> = ({ logs, getEffectiveScheduleTime }) => {
    const incidents = useMemo(() => {
        const incidents: Incident[] = [];
        const groupedLogs: { [key: string]: LogEntry[] } = {};

        // Agrupar logs por colaborador y día
        logs.forEach(log => {
            const date = new Date(log.timestamp).toISOString().slice(0, 10);
            const key = `${log.employeeName}__${date}`;
            if (!groupedLogs[key]) {
                groupedLogs[key] = [];
            }
            groupedLogs[key].push(log);
        });

        for (const key in groupedLogs) {
            const [employeeName, date] = key.split('__');
            const dailyLogs = groupedLogs[key].sort((a, b) => a.timestamp - b.timestamp);
            
            const checkIn = dailyLogs.find(log => log.type === LogType.ENTRADA);
            const checkOut = dailyLogs.find(log => log.type === LogType.SALIDA);
            const lunchStart = dailyLogs.find(log => log.type === LogType.INICIO_COMIDA);
            const lunchEnd = dailyLogs.find(log => log.type === LogType.FIN_COMIDA);

            // 1. Verificar retardos
            if (checkIn) {
                const scheduleTime = getEffectiveScheduleTime(employeeName, checkIn.timestamp);
                if (scheduleTime) {
                    const checkInTime = new Date(checkIn.timestamp);
                    const [hours, minutes] = scheduleTime.split(':').map(Number);
                    const scheduleDate = new Date(checkIn.timestamp);
                    scheduleDate.setHours(hours, minutes, 0, 0);

                    // 10 minutos de tolerancia
                    const toleranceDeadline = new Date(scheduleDate.getTime() + 10 * 60 * 1000);

                    if (checkInTime > toleranceDeadline) {
                        const lateMinutes = Math.round((checkInTime.getTime() - scheduleDate.getTime()) / 60000);

                        const h = Math.floor(lateMinutes / 60);
                        const m = lateMinutes % 60;

                        let details = 'Llegó ';
                        if (h > 0) {
                            details += `${h}h `;
                        }
                        details += `${m}m tarde.`;

                        incidents.push({
                            employeeName,
                            date,
                            type: IncidentType.LATE_ARRIVAL,
                            details: details
                        });
                    }
                }
            }
            
            // 2. Verificar comidas no registradas
            if (checkIn && checkOut && (!lunchStart || !lunchEnd)) {
                 incidents.push({
                    employeeName,
                    date,
                    type: IncidentType.MISSED_LUNCH,
                    details: 'No se registraron ambos tiempos de comida.'
                });
            }

            // 3. Verificar salidas no registradas (para días pasados)
            const today = new Date().toISOString().slice(0, 10);
            if (date < today && checkIn && !checkOut) {
                 incidents.push({
                    employeeName,
                    date,
                    type: IncidentType.NO_CHECK_OUT,
                    details: 'No registró su hora de salida.'
                });
            }
        }
        return incidents.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [logs, getEffectiveScheduleTime]);

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {incidents.length > 0 ? incidents.map((incident, index) => (
        <div key={index} className="p-3 bg-white/60 rounded-lg shadow-sm border border-slate-200">
            <p className="font-semibold text-sm text-slate-800">{incident.employeeName}</p>
            <div className="flex justify-between items-baseline">
                 <p className="text-xs text-slate-600">{new Date(incident.date + 'T12:00:00').toLocaleDateString('es-MX', {day: '2-digit', month: 'long'})}</p>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    incident.type === IncidentType.LATE_ARRIVAL ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                    {incident.type}
                </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{incident.details}</p>
        </div>
      )) : (
        <p className="text-center text-sm text-slate-500 py-4">No se encontraron incidencias en el período seleccionado.</p>
      )}
    </div>
  );
};
