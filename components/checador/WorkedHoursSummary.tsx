import React, { useMemo } from 'react';
import type { LogEntry } from '../../types';
import { LogType } from '../../types';
import { DownloadIcon } from './icons/DownloadIcon';
import { toLocalDateKey } from '../../utils/dateUtils';

interface WorkedHoursSummaryProps {
  logs: LogEntry[];
}

interface DailySummary {
    employeeName: string;
    date: string;
    workedTime: number | null; // in minutes
    lunchDeducted: boolean; // false = horas infladas (no se descontó comida)
}

export const WorkedHoursSummary: React.FC<WorkedHoursSummaryProps> = ({ logs }) => {
    const summary = useMemo(() => {
        const dailySummaries: DailySummary[] = [];
        const groupedLogs: { [key: string]: LogEntry[] } = {};

        logs.forEach(log => {
            const date = toLocalDateKey(log.timestamp);
            const key = `${log.employeeName}__${date}`;
            if (!groupedLogs[key]) groupedLogs[key] = [];
            groupedLogs[key].push(log);
        });

        for (const key in groupedLogs) {
            const [employeeName, date] = key.split('__');
            const dailyLogs = groupedLogs[key];

            const sortedLogs = [...dailyLogs].sort((a, b) => a.timestamp - b.timestamp);
            const checkIn = sortedLogs.find(l => l.type === LogType.ENTRADA); // primera entrada
            const checkOut = [...sortedLogs].reverse().find(l => l.type === LogType.SALIDA); // ultima salida
            
            if (checkIn && checkOut) {
                let totalMillis = checkOut.timestamp - checkIn.timestamp;
                
                // Descontar TODAS las pausas de comida (no solo la primera)
                const lunchStarts = sortedLogs.filter(l => l.type === LogType.INICIO_COMIDA);
                const lunchEnds = sortedLogs.filter(l => l.type === LogType.FIN_COMIDA);
                const pairs = Math.min(lunchStarts.length, lunchEnds.length);
                let deductedPairs = 0;
                for (let i = 0; i < pairs; i++) {
                    if (lunchEnds[i].timestamp > lunchStarts[i].timestamp) {
                        totalMillis -= (lunchEnds[i].timestamp - lunchStarts[i].timestamp);
                        deductedPairs++;
                    }
                }

                dailySummaries.push({ employeeName, date, workedTime: totalMillis / (1000 * 60), lunchDeducted: deductedPairs > 0 });
            } else {
                dailySummaries.push({ employeeName, date, workedTime: null, lunchDeducted: false });
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
        const csvRows = ["Colaborador,Fecha,Horas Trabajadas (minutos),Formato,Observacion"];

        summary.forEach(item => {
            const formattedTime = item.workedTime !== null ? `${Math.floor(item.workedTime / 60)}h ${Math.round(item.workedTime % 60)}m` : "Incompleto";
            const observacion = item.workedTime !== null && !item.lunchDeducted ? "Sin descuento de comida (horas posiblemente infladas)" : "";
            const row = [
                `"${item.employeeName.replace(/"/g, '""')}"`,
                `"${item.date}"`,
                item.workedTime ?? 'N/A',
                `"${formattedTime}"`,
                `"${observacion}"`
            ].join(",");
            csvRows.push(row);
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "resumen_horas_trabajadas.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
                <div className="flex items-center gap-2">
                    {item.workedTime !== null && !item.lunchDeducted && (
                        <span
                            className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800"
                            title="No se registró comida: el total no descuenta el tiempo de comida y puede estar inflado."
                        >
                            ⚠ sin comida
                        </span>
                    )}
                    <span className="font-mono text-slate-900">
                        {formatTime(item.workedTime)}
                    </span>
                </div>
            </div>
          )) : (
            <p className="text-center text-sm text-slate-500 py-4">No hay registros completos en el período seleccionado.</p>
          )}
        </div>
    </div>
  );
};
