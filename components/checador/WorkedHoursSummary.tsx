import React, { useMemo } from 'react';
import type { LogEntry } from '../../types';
import { LogType } from '../../types';
import { DownloadIcon } from './icons/DownloadIcon';

interface WorkedHoursSummaryProps {
  logs: LogEntry[];
}

interface DailySummary {
    employeeName: string;
    date: string;
    workedTime: number | null; // in minutes
}

export const WorkedHoursSummary: React.FC<WorkedHoursSummaryProps> = ({ logs }) => {
    const summary = useMemo(() => {
        const dailySummaries: DailySummary[] = [];
        const groupedLogs: { [key: string]: LogEntry[] } = {};

        logs.forEach(log => {
            const date = new Date(log.timestamp).toISOString().slice(0, 10);
            const key = `${log.employeeName}__${date}`;
            if (!groupedLogs[key]) groupedLogs[key] = [];
            groupedLogs[key].push(log);
        });

        for (const key in groupedLogs) {
            const [employeeName, date] = key.split('__');
            const dailyLogs = groupedLogs[key];

            const checkIn = dailyLogs.find(l => l.type === LogType.ENTRADA);
            const checkOut = dailyLogs.find(l => l.type === LogType.SALIDA);
            
            if (checkIn && checkOut) {
                let totalMillis = checkOut.timestamp - checkIn.timestamp;
                
                const lunchStart = dailyLogs.find(l => l.type === LogType.INICIO_COMIDA);
                const lunchEnd = dailyLogs.find(l => l.type === LogType.FIN_COMIDA);

                if (lunchStart && lunchEnd) {
                    totalMillis -= (lunchEnd.timestamp - lunchStart.timestamp);
                }

                dailySummaries.push({ employeeName, date, workedTime: totalMillis / (1000 * 60) });
            } else {
                dailySummaries.push({ employeeName, date, workedTime: null });
            }
        }
        return dailySummaries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.employeeName.localeCompare(b.employeeName));
    }, [logs]);

    const formatTime = (minutes: number | null) => {
        if (minutes === null) return <span className="font-semibold text-red-600">Incompleto</span>;
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return `${h}h ${m}m`;
    };

    const downloadCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Colaborador,Fecha,Horas Trabajadas (minutos),Formato\n";

        summary.forEach(item => {
            const formattedTime = item.workedTime !== null ? `${Math.floor(item.workedTime / 60)}h ${Math.round(item.workedTime % 60)}m` : "Incompleto";
            const row = [item.employeeName, item.date, item.workedTime ?? 'N/A', formattedTime].join(",");
            csvContent += row + "\r\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "resumen_horas_trabajadas.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

  return (
     <div>
        <button onClick={downloadCSV} className="absolute top-4 right-4 text-slate-500 hover:text-slate-800">
            <DownloadIcon />
        </button>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {summary.length > 0 ? summary.map((item, index) => (
            <div key={index} className="flex justify-between items-center p-2 bg-white/60 rounded-lg text-sm">
                <div>
                    <p className="font-semibold text-slate-800">{item.employeeName}</p>
                    <p className="text-xs text-slate-500">{new Date(item.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
                </div>
                <div className="font-mono text-slate-900">
                    {formatTime(item.workedTime)}
                </div>
            </div>
          )) : (
            <p className="text-center text-sm text-slate-500 py-4">No hay registros completos en el período seleccionado.</p>
          )}
        </div>
    </div>
  );
};
