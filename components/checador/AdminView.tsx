import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { LogEntry, DetailedEmployee, PermissionRequest } from '../../types';
import { LogType, PermissionType, Compensation } from '../../types';
import { EMPLOYEES } from '../../checadorConstants';
import { AdminLogTable } from './AdminLogTable';
import { IncidentsReport } from './IncidentsReport';
import { WorkedHoursSummary } from './WorkedHoursSummary';
import { DownloadIcon } from './icons/DownloadIcon';

interface AdminViewProps {
  onExit: () => void;
}

interface ScheduleConfig {
  type: 'indeterminado' | 'determinado';
  time: string;
  startDate?: string;
  endDate?: string;
}

const calculateTenure = (startDateString: string): string => {
  if (!startDateString) return 'N/A';
  
  const startDate = new Date(startDateString + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (isNaN(startDate.getTime()) || startDate > today) {
    return 'Fecha inválida';
  }

  let years = today.getFullYear() - startDate.getFullYear();
  let months = today.getMonth() - startDate.getMonth();
  let days = today.getDate() - startDate.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }
  
  const parts = [];
  if (years > 0) parts.push(`${years} año${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mes${months > 1 ? 'es' : ''}`);
  if (days > 0) parts.push(`${days} día${days > 1 ? 's' : ''}`);
  
  return parts.length > 0 ? parts.join(', ') : "Menos de un día";
};

// --- Helper functions for permission time calculation ---
const timeToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
};

const formatMinutes = (minutes: number): string => {
    if (minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(' ');
};

const calculateMinutesToCompensate = (req: PermissionRequest): number => {
    const { permissionType, arrivalTime, departureTime, absenceStartTime, absenceEndTime, daysCount } = req;
    
    const WORKDAY_START_MINUTES = 9 * 60; // 09:00
    const WORKDAY_END_MINUTES = 18 * 60;   // 18:00
    const WORKDAY_DURATION_MINUTES = 8 * 60; // 8 hours

    switch (permissionType) {
        case PermissionType.FULL_DAYS:
            return (daysCount || 0) * WORKDAY_DURATION_MINUTES;
        case PermissionType.LATE_ARRIVAL:
            const arrival = timeToMinutes(arrivalTime);
            return arrival > WORKDAY_START_MINUTES ? arrival - WORKDAY_START_MINUTES : 0;
        case PermissionType.EARLY_DEPARTURE:
            const departure = timeToMinutes(departureTime);
            return departure < WORKDAY_END_MINUTES ? WORKDAY_END_MINUTES - departure : 0;
        case PermissionType.PARTIAL_ABSENCE:
            const start = timeToMinutes(absenceStartTime);
            const end = timeToMinutes(absenceEndTime);
            return end > start ? end - start : 0;
        default:
            return 0;
    }
};
// --------------------------------------------------------

const generateTimeOptions = (): string[] => {
    const options = [];
    for (let h = 7; h < 21; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hour = h.toString().padStart(2, '0');
            const minute = m.toString().padStart(2, '0');
            options.push(`${hour}:${minute}`);
        }
    }
    return options;
};


export const AdminView: React.FC<AdminViewProps> = ({ onExit }) => {
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [schedules, setSchedules] = useState<{ [key: string]: ScheduleConfig }>({});
  const [detailedEmployees, setDetailedEmployees] = useState<DetailedEmployee[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const timeOptions = useMemo(() => generateTimeOptions(), []);
  
  const initialFormState: Omit<DetailedEmployee, 'id' | 'codigo' | 'horarioLunesMiercolesViernes' | 'horarioJueves' | 'horarioSabado'> = {
    paterno: '',
    materno: '',
    nombres: '',
    fechaIngreso: new Date().toISOString().slice(0, 10),
    fechaNacimiento: '',
    curp: '',
    rfc: '',
    nss: '',
    departamento: '',
    puesto: '',
    bonoPuntualidad: 0,
    bonoObjetivos: 0,
    apoyoGasolina: 0,
  };
  const [newEmployee, setNewEmployee] = useState(initialFormState);
  const [isEmployeeSectionVisible, setIsEmployeeSectionVisible] = useState(false);
  
  const initialScheduleState = {
    lunesMiercolesViernesEntrada: '09:00',
    lunesMiercolesViernesSalida: '18:00',
    juevesTrabaja: 'si',
    juevesEntrada: '09:00',
    juevesSalida: '18:00',
    sabadoTrabaja: 'si',
    sabEntrada: '09:00',
    sabSalida: '14:00',
  };
  const [scheduleForm, setScheduleForm] = useState(initialScheduleState);


  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    // Cargar todos los registros
    const storedLogs = localStorage.getItem('all_employee_logs');
    if (storedLogs) {
      setAllLogs(JSON.parse(storedLogs));
    }

    // Cargar horarios con migración de datos viejos
    const storedSchedules = localStorage.getItem('employee_schedules');
    if (storedSchedules) {
        const parsedSchedules = JSON.parse(storedSchedules);
        const migratedSchedules: { [key: string]: ScheduleConfig } = {};
        for (const empName in parsedSchedules) {
            const value = parsedSchedules[empName];
            if (typeof value === 'string') {
                migratedSchedules[empName] = { type: 'indeterminado', time: value };
            } else if (typeof value === 'object' && value.time) {
                migratedSchedules[empName] = value;
            }
        }
        setSchedules(migratedSchedules);
    } else {
        const defaultSchedules = EMPLOYEES.reduce((acc, emp) => {
            acc[emp.name] = { type: 'indeterminado', time: emp.scheduleStartTime };
            return acc;
        }, {} as {[key: string]: ScheduleConfig});
        setSchedules(defaultSchedules);
    }

    // Cargar empleados detallados
    const storedEmployeesStr = localStorage.getItem('detailed_employees');
    if (storedEmployeesStr) {
        setDetailedEmployees(JSON.parse(storedEmployeesStr));
    }
    
    // Cargar solicitudes de permiso
    const storedPermissions = localStorage.getItem('permission_requests');
    if (storedPermissions) {
        setPermissionRequests(JSON.parse(storedPermissions));
    }
  }, []);

  const calculatedOwedHours = useMemo(() => {
    const owedByEmployee: { [key: string]: number } = {};

    permissionRequests.forEach(req => {
        if (req.compensation === Compensation.EXTRA_TIME) {
            // Construct the name key in the same format as EMPLOYEES list (PATERNO MATERNO NOMBRES)
            const employeeFullName = `${req.lastName} ${req.motherLastName} ${req.firstName}`.toUpperCase().replace(/\s+/g, ' ').trim();
            const minutesToCompensate = calculateMinutesToCompensate(req);
            
            if (!owedByEmployee[employeeFullName]) {
                owedByEmployee[employeeFullName] = 0;
            }
            owedByEmployee[employeeFullName] += minutesToCompensate;
        }
    });
    
    // Convert minutes to hours for display
    for (const empName in owedByEmployee) {
        owedByEmployee[empName] = owedByEmployee[empName] / 60;
    }

    return owedByEmployee;
  }, [permissionRequests]);

  const filteredLogs = useMemo(() => {
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(23, 59, 59, 999);
    return allLogs.filter(log => log.timestamp >= start && log.timestamp <= end);
  }, [allLogs, startDate, endDate]);

  const getEffectiveScheduleTime = useCallback((employeeName: string, timestamp: number): string => {
    const scheduleConfig = schedules[employeeName];
    const defaultSchedule = EMPLOYEES.find(e => e.name === employeeName)?.scheduleStartTime || '09:00';

    if (!scheduleConfig) {
      return defaultSchedule;
    }

    if (scheduleConfig.type === 'determinado' && scheduleConfig.startDate && scheduleConfig.endDate) {
      const logDate = new Date(timestamp);
      const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

      const startDate = new Date(scheduleConfig.startDate + 'T00:00:00');
      const endDate = new Date(scheduleConfig.endDate + 'T00:00:00');

      if (logDateOnly >= startDate && logDateOnly <= endDate) {
        return scheduleConfig.time;
      } else {
        return defaultSchedule;
      }
    }

    return scheduleConfig.time || defaultSchedule;
  }, [schedules]);

  const handleDownloadLogs = () => {
    const sortedLogs = [...filteredLogs].sort((a, b) => a.timestamp - b.timestamp);
    const headers = ['Colaborador', 'Tipo', 'Fecha', 'Hora', 'Incidencia', 'Coordenadas'];

    const formatDate = (ts: number) => new Date(ts).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const getIncident = (log: LogEntry): string => {
      if (log.type !== LogType.ENTRADA) return '';
      const scheduleTime = getEffectiveScheduleTime(log.employeeName, log.timestamp);
      if (!scheduleTime) return '';

      const logDate = new Date(log.timestamp);
      const [hours, minutes] = scheduleTime.split(':').map(Number);
      
      const scheduleDate = new Date(logDate);
      scheduleDate.setHours(hours, minutes, 0, 0);

      const toleranceDeadline = new Date(scheduleDate.getTime() + 10 * 60 * 1000);
      return logDate > toleranceDeadline ? 'Retardo' : '';
    };

    const csvRows = [headers.join(',')];
    sortedLogs.forEach(log => {
      const incident = getIncident(log);
      const coordinates = log.location ? `${log.location.lat.toFixed(4)}, ${log.location.lon.toFixed(4)}` : 'No disponible';
      
      const row = [
        `"${log.employeeName.replace(/"/g, '""')}"`,
        `"${log.type}"`,
        `"${formatDate(log.timestamp)}"`,
        `"${formatTime(log.timestamp)}"`,
        `"${incident}"`,
        `"${coordinates}"`
      ].join(',');
      csvRows.push(row);
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `registros_asistencia_${startDate}_a_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleScheduleChange = (employeeName: string, field: keyof ScheduleConfig, value: string) => {
    setSchedules(prev => {
        const currentSchedule = prev[employeeName] || { 
            type: 'indeterminado', 
            time: EMPLOYEES.find(e => e.name === employeeName)?.scheduleStartTime || '09:00',
            startDate: '',
            endDate: '',
        };

        const newSchedule = { ...currentSchedule, [field]: value };
        
        if (field === 'type' && value === 'indeterminado') {
            newSchedule.startDate = '';
            newSchedule.endDate = '';
        }

        return { ...prev, [employeeName]: newSchedule };
    });
  };

  const saveSchedules = () => {
    localStorage.setItem('employee_schedules', JSON.stringify(schedules));
    alert('Horarios guardados.');
  };

  const handleNewEmployeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setNewEmployee(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };
  
  const handleScheduleFormChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setScheduleForm(prev => ({ ...prev, [name]: value }));
  };

  const handleRegisterEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newEmployee.nombres || !newEmployee.paterno || !newEmployee.fechaNacimiento) {
      alert('Nombre(s), Apellido Paterno y Fecha de Cumpleaños son obligatorios.');
      return;
    }

    const storedEmployeesStr = localStorage.getItem('detailed_employees');
    const existingEmployees: DetailedEmployee[] = storedEmployeesStr ? JSON.parse(storedEmployeesStr) : [];
    
    const [year, month, day] = newEmployee.fechaNacimiento.split('-');
    const baseCode = `${day}${month}${year.slice(-2)}`;
    
    let employeeCode = baseCode;
    let counter = 1;
    while (existingEmployees.some(emp => emp.codigo === employeeCode)) {
        employeeCode = `${baseCode}-${counter}`;
        counter++;
    }
    
    const finalHorarioLMV = `${scheduleForm.lunesMiercolesViernesEntrada} - ${scheduleForm.lunesMiercolesViernesSalida}`;
    const finalHorarioJueves = scheduleForm.juevesTrabaja === 'si'
        ? `${scheduleForm.juevesEntrada} - ${scheduleForm.juevesSalida}`
        : 'No labora';
    const finalHorarioSab = scheduleForm.sabadoTrabaja === 'si'
        ? `${scheduleForm.sabEntrada} - ${scheduleForm.sabSalida}`
        : 'No labora';

    const newEmployeeRecord: DetailedEmployee = {
      id: Date.now().toString(),
      codigo: employeeCode,
      ...newEmployee,
      horarioLunesMiercolesViernes: finalHorarioLMV,
      horarioJueves: finalHorarioJueves,
      horarioSabado: finalHorarioSab,
      bonoPuntualidad: Number(newEmployee.bonoPuntualidad),
      bonoObjetivos: Number(newEmployee.bonoObjetivos),
      apoyoGasolina: Number(newEmployee.apoyoGasolina),
    };
    
    const updatedEmployees = [...existingEmployees, newEmployeeRecord];
    localStorage.setItem('detailed_employees', JSON.stringify(updatedEmployees));
    
    setDetailedEmployees(updatedEmployees);
    alert(`Colaborador ${newEmployee.nombres} ${newEmployee.paterno} registrado exitosamente. Código: ${employeeCode}`);
    setNewEmployee(initialFormState);
    setScheduleForm(initialScheduleState);
  };

  const handleDownloadEmployeesCSV = () => {
    if (detailedEmployees.length === 0) {
        alert('No hay colaboradores registrados para descargar.');
        return;
    }

    const headers = [
        'ID', 'Código', 'Apellido Paterno', 'Apellido Materno', 'Nombre(s)', 
        'Fecha de Ingreso', 'Fecha de Cumpleaños', 'Antigüedad', 'CURP', 'RFC', 'NSS', 'Departamento', 'Puesto',
        'Horario L,M,M,V', 'Horario Jueves Caminata De Arte', 'Horario Sábado',
        'Bono Puntualidad', 'Bono Objetivos', 'Apoyo Gasolina'
    ];

    const csvRows = [headers.join(',')];

    detailedEmployees.forEach(emp => {
        const tenure = calculateTenure(emp.fechaIngreso);
        const row = [
            `"${emp.id}"`, `"${emp.codigo}"`, `"${emp.paterno}"`, `"${emp.materno}"`, `"${emp.nombres}"`,
            `"${emp.fechaIngreso}"`, `"${emp.fechaNacimiento}"`, `"${tenure}"`, `"${emp.curp}"`, `"${emp.rfc}"`, `"${emp.nss}"`,
            `"${emp.departamento}"`, `"${emp.puesto}"`,
            `"${emp.horarioLunesMiercolesViernes}"`, `"${emp.horarioJueves}"`, `"${emp.horarioSabado}"`,
            emp.bonoPuntualidad,
            emp.bonoObjetivos, emp.apoyoGasolina
        ].join(',');
        csvRows.push(row);
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `lista_colaboradores.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const getPermissionDetailsText = (req: PermissionRequest) => {
    switch (req.permissionType) {
        case PermissionType.FULL_DAYS:
            return req.dates?.map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-MX')).join(', ') || 'Fechas no especificadas';
        case PermissionType.LATE_ARRIVAL:
            return `Llegada a las ${req.arrivalTime}`;
        case PermissionType.EARLY_DEPARTURE:
            return `Salida a las ${req.departureTime}`;
        case PermissionType.PARTIAL_ABSENCE:
            return `De ${req.absenceStartTime} a ${req.absenceEndTime}`;
        default:
            return 'N/A';
    }
  };

  const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-slate-700 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-serif text-3xl font-bold text-slate-900">Panel de Administración</h1>
        <button onClick={onExit} className="text-sm font-medium text-amber-600 hover:underline">Salir de Administración</button>
      </div>

      <div className="space-y-8">
        {/* Filtros y Logs */}
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800">Registros de Asistencia</h2>
            <button
              onClick={handleDownloadLogs}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center px-3 py-1 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white/60 hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:bg-slate-100/50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <DownloadIcon />
              <span className="ml-2">Descargar CSV</span>
            </button>
          </div>
          <div className="flex items-center space-x-4 mb-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">Desde</label>
              <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-slate-700">Hasta</label>
              <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
            </div>
          </div>
          <AdminLogTable logs={filteredLogs} getEffectiveScheduleTime={getEffectiveScheduleTime} />
        </div>

        {/* Reportes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Resumen de Horas Trabajadas</h2>
            <WorkedHoursSummary logs={filteredLogs} />
          </div>
          <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Reporte de Incidencias</h2>
            <IncidentsReport logs={filteredLogs} getEffectiveScheduleTime={getEffectiveScheduleTime} />
          </div>
        </div>

        {/* Solicitudes de Permiso */}
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Solicitudes de Permiso</h2>
            <div className="overflow-x-auto max-h-96">
                <table className="min-w-full bg-white/60 rounded-lg shadow">
                    <thead className="bg-white/80 sticky top-0">
                        <tr>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Colaborador</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha Solicitud</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tipo</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Detalles</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horas a Reponer</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Motivo</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {permissionRequests.length > 0 ? [...permissionRequests].reverse().map(req => (
                            <tr key={req.id} className="hover:bg-slate-100/50">
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-800">{`${req.firstName} ${req.lastName} ${req.motherLastName}`}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{new Date(req.requestDate + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{req.permissionType}</td>
                                <td className="py-3 px-4 text-sm text-slate-700">{getPermissionDetailsText(req)}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-center">
                                    {req.compensation === Compensation.EXTRA_TIME ? (
                                        <span className="font-mono font-semibold text-amber-800 bg-amber-100/60 px-2 py-1 rounded">
                                            {formatMinutes(calculateMinutesToCompensate(req))}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">-</span>
                                    )}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{req.reason}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        req.status === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {req.status}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={7} className="text-center py-4 text-sm text-slate-500">No hay solicitudes de permiso registradas.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Gestión */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Gestión de Horarios</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {EMPLOYEES.map(emp => {
                      const currentSchedule = schedules[emp.name] || { type: 'indeterminado', time: emp.scheduleStartTime };
                      return (
                        <div key={emp.name} className="p-3 bg-slate-50/50 rounded-md border border-slate-200 space-y-2">
                            <label className="text-sm text-slate-800 font-medium block">{emp.name}</label>
                            <div className="grid grid-cols-2 gap-2">
                              <select 
                                  value={currentSchedule.type} 
                                  onChange={e => handleScheduleChange(emp.name, 'type', e.target.value)}
                                  className="w-full px-2 py-1 bg-white/40 border border-slate-300 rounded-md shadow-sm text-sm"
                              >
                                  <option value="indeterminado">Indeterminado</option>
                                  <option value="determinado">Determinado</option>
                              </select>
                              <input 
                                  type="time" 
                                  value={currentSchedule.time} 
                                  onChange={e => handleScheduleChange(emp.name, 'time', e.target.value)} 
                                  className="w-full px-2 py-1 bg-white/40 border border-slate-300 rounded-md shadow-sm text-sm"
                              />
                            </div>
                            {currentSchedule.type === 'determinado' && (
                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 mt-2">
                                  <div>
                                      <label className="text-xs text-slate-600 block mb-1">Desde</label>
                                      <input 
                                          type="date" 
                                          value={currentSchedule.startDate || ''} 
                                          onChange={e => handleScheduleChange(emp.name, 'startDate', e.target.value)} 
                                          className="w-full px-2 py-1 bg-white/40 border border-slate-300 rounded-md shadow-sm text-sm"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-xs text-slate-600 block mb-1">Hasta</label>
                                      <input 
                                          type="date" 
                                          value={currentSchedule.endDate || ''} 
                                          onChange={e => handleScheduleChange(emp.name, 'endDate', e.target.value)} 
                                          className="w-full px-2 py-1 bg-white/40 border border-slate-300 rounded-md shadow-sm text-sm"
                                      />
                                  </div>
                              </div>
                            )}
                        </div>
                      )
                    })}
                </div>
                <button onClick={saveSchedules} className="mt-4 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">Guardar Horarios</button>
            </div>
            <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Resumen de Horas Pendientes por Reponer</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {EMPLOYEES.map(emp => {
                      const employeeNameKey = emp.name.toUpperCase().replace(/\s+/g, ' ').trim();
                      const hours = calculatedOwedHours[employeeNameKey] || 0;
                      return (
                        <div key={emp.name} className="flex items-center justify-between p-2 bg-slate-50/50 rounded-md border border-slate-200">
                            <p className="text-sm text-slate-800">{emp.name}</p>
                            <div className="text-right">
                              <p className="w-24 text-center px-2 py-1 bg-amber-100/60 rounded-md font-mono font-bold text-amber-900 text-base">
                                  {hours.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500">horas</p>
                            </div>
                        </div>
                      )
                    })}
                </div>
                <p className="mt-4 text-xs text-slate-500 text-center">
                    Este es un cálculo automático basado en las solicitudes de permiso con "Reposición con tiempo de trabajo adicional".
                </p>
            </div>
        </div>

        {/* Alta de Nuevo Colaborador */}
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
          <button 
            onClick={() => setIsEmployeeSectionVisible(!isEmployeeSectionVisible)} 
            className="w-full flex justify-between items-center text-left"
          >
            <h2 className="text-xl font-bold text-slate-800">Alta y Gestión de Colaboradores</h2>
            <ChevronDownIcon className={`transition-transform duration-300 ${isEmployeeSectionVisible ? 'rotate-180' : ''}`} />
          </button>
          
          {isEmployeeSectionVisible && (
            <div className="mt-6 border-t pt-6 border-slate-300/50">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Alta de Nuevo Colaborador</h3>
              <form onSubmit={handleRegisterEmployee} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="nombres" className="block text-sm font-medium text-slate-700">Nombre(s)</label>
                    <input type="text" name="nombres" id="nombres" value={newEmployee.nombres} onChange={handleNewEmployeeChange} required className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="paterno" className="block text-sm font-medium text-slate-700">Apellido Paterno</label>
                    <input type="text" name="paterno" id="paterno" value={newEmployee.paterno} onChange={handleNewEmployeeChange} required className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="materno" className="block text-sm font-medium text-slate-700">Apellido Materno</label>
                    <input type="text" name="materno" id="materno" value={newEmployee.materno} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="fechaIngreso" className="block text-sm font-medium text-slate-700">Fecha de Ingreso</label>
                        <input type="date" name="fechaIngreso" id="fechaIngreso" value={newEmployee.fechaIngreso} onChange={handleNewEmployeeChange} required className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="fechaNacimiento" className="block text-sm font-medium text-slate-700">Fecha de Cumpleaños</label>
                        <input type="date" name="fechaNacimiento" id="fechaNacimiento" value={newEmployee.fechaNacimiento} onChange={handleNewEmployeeChange} required className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="curp" className="block text-sm font-medium text-slate-700">CURP</label>
                    <input type="text" name="curp" id="curp" value={newEmployee.curp} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="rfc" className="block text-sm font-medium text-slate-700">RFC</label>
                    <input type="text" name="rfc" id="rfc" value={newEmployee.rfc} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="nss" className="block text-sm font-medium text-slate-700">NSS</label>
                    <input type="text" name="nss" id="nss" value={newEmployee.nss} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="departamento" className="block text-sm font-medium text-slate-700">Departamento</label>
                    <input type="text" name="departamento" id="departamento" value={newEmployee.departamento} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="puesto" className="block text-sm font-medium text-slate-700">Puesto</label>
                    <input type="text" name="puesto" id="puesto" value={newEmployee.puesto} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                </div>
                
                {/* --- Horarios Start --- */}
                <div className="p-4 bg-black/5 border border-slate-300/50 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Horario Lunes, Martes, Miércoles y Viernes</label>
                    <div className="mt-1 grid grid-cols-2 gap-4">
                        <select name="lunesMiercolesViernesEntrada" value={scheduleForm.lunesMiercolesViernesEntrada} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                            {timeOptions.map(t => <option key={`lmv-in-${t}`} value={t}>{t}</option>)}
                        </select>
                        <select name="lunesMiercolesViernesSalida" value={scheduleForm.lunesMiercolesViernesSalida} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                            {timeOptions.map(t => <option key={`lmv-out-${t}`} value={t}>{t}</option>)}
                        </select>
                    </div>
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-slate-700">Horario Jueves Caminata De Arte</label>
                    <div className="mt-1 grid grid-cols-3 gap-4">
                        <select name="juevesTrabaja" value={scheduleForm.juevesTrabaja} onChange={handleScheduleFormChange} className="col-span-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                            <option value="si">Trabaja</option>
                            <option value="no">Descansa</option>
                        </select>
                        {scheduleForm.juevesTrabaja === 'si' && (
                            <>
                               <select name="juevesEntrada" value={scheduleForm.juevesEntrada} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                                    {timeOptions.map(t => <option key={`jue-in-${t}`} value={t}>{t}</option>)}
                                </select>
                                <select name="juevesSalida" value={scheduleForm.juevesSalida} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                                    {timeOptions.map(t => <option key={`jue-out-${t}`} value={t}>{t}</option>)}
                                </select>
                            </>
                        )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Horario Sábado</label>
                    <div className="mt-1 grid grid-cols-3 gap-4">
                        <select name="sabadoTrabaja" value={scheduleForm.sabadoTrabaja} onChange={handleScheduleFormChange} className="col-span-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                            <option value="si">Trabaja</option>
                            <option value="no">Descansa</option>
                        </select>
                        {scheduleForm.sabadoTrabaja === 'si' && (
                            <>
                               <select name="sabEntrada" value={scheduleForm.sabEntrada} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                                    {timeOptions.map(t => <option key={`sab-in-${t}`} value={t}>{t}</option>)}
                                </select>
                                <select name="sabSalida" value={scheduleForm.sabSalida} onChange={handleScheduleFormChange} className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm">
                                    {timeOptions.map(t => <option key={`sab-out-${t}`} value={t}>{t}</option>)}
                                </select>
                            </>
                        )}
                    </div>
                  </div>
                </div>
                {/* --- Horarios End --- */}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="bonoPuntualidad" className="block text-sm font-medium text-slate-700">Bono Puntualidad ($)</label>
                    <input type="number" step="0.01" min="0" name="bonoPuntualidad" id="bonoPuntualidad" value={newEmployee.bonoPuntualidad} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="bonoObjetivos" className="block text-sm font-medium text-slate-700">Bono Objetivos ($)</label>
                    <input type="number" step="0.01" min="0" name="bonoObjetivos" id="bonoObjetivos" value={newEmployee.bonoObjetivos} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                  <div>
                    <label htmlFor="apoyoGasolina" className="block text-sm font-medium text-slate-700">Apoyo Gasolina ($)</label>
                    <input type="number" step="0.01" min="0" name="apoyoGasolina" id="apoyoGasolina" value={newEmployee.apoyoGasolina} onChange={handleNewEmployeeChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">Registrar Colaborador</button>
                </div>
              </form>

              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Colaboradores Registrados</h3>
                    <button
                    onClick={handleDownloadEmployeesCSV}
                    disabled={detailedEmployees.length === 0}
                    className="inline-flex items-center px-3 py-1 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white/60 hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:bg-slate-100/50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                    <DownloadIcon />
                    <span className="ml-2">Descargar Excel</span>
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white/60 rounded-lg shadow">
                        <thead className="bg-white/80">
                            <tr>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Código</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Nombre Completo</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Puesto</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Departamento</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario L,M,M,V</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario Jueves Caminata De Arte</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario Sáb</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha Ingreso</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Cumpleaños</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Antigüedad</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">RFC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {detailedEmployees.length > 0 ? detailedEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-100/50">
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{emp.codigo}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-800">{`${emp.nombres} ${emp.paterno} ${emp.materno}`}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.puesto}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.departamento}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.horarioLunesMiercolesViernes}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.horarioJueves}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.horarioSabado}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{emp.fechaIngreso}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{emp.fechaNacimiento}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{calculateTenure(emp.fechaIngreso)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{emp.rfc}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={11} className="text-center py-4 text-sm text-slate-500">No hay colaboradores registrados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};