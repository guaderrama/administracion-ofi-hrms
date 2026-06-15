import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { LogEntry, DetailedEmployee, PermissionRequest } from '../../types';
import { LogType, PermissionType, Compensation, CompensationMethod } from '../../types';
import { EMPLOYEES } from '../../checadorConstants';
import { AdminLogTable } from './AdminLogTable';
import { IncidentsReport } from './IncidentsReport';
import { WorkedHoursSummary } from './WorkedHoursSummary';
import { DownloadIcon } from './icons/DownloadIcon';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../../src/firebaseConfig';
import { deleteField } from 'firebase/firestore';
import { employeesService, logsService, permissionsService, cleanDuplicateLogs, tardinessService, motivationalService, toleranceService, vacationRequestsService, type TardinessAdjustment, type MotivationalSettings, type ToleranceSettings, type VacationRequestRecord } from '../../src/services/firestoreService';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../src/contexts/AuthContext';

declare const jspdf: any;

interface AdminViewProps {
  onExit: () => void;
}

function generateVacationPdf(vr: VacationRequestRecord) {
  const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const ml = 20;
  const mr = 20;
  const cw = pageWidth - ml - mr;
  let y = 18;

  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtDateShort = (s: string) => {
    const f = new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return f.charAt(0).toUpperCase() + f.slice(1);
  };
  const line = (yy: number) => { pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3); pdf.line(ml, yy, pageWidth - mr, yy); };

  // Header
  pdf.setFont('times', 'bold'); pdf.setFontSize(20); pdf.setTextColor(30, 41, 59);
  pdf.text('IVAN GUADERRAMA ART', pageWidth / 2, y, { align: 'center' }); y += 6;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); pdf.setTextColor(100, 116, 139);
  pdf.text('Papeleta de Vacaciones', pageWidth / 2, y, { align: 'center' }); y += 4;
  line(y); y += 7;

  // Fecha solicitud
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(30, 41, 59);
  pdf.text('Fecha de Solicitud: ', ml, y);
  const lw = pdf.getTextWidth('Fecha de Solicitud: ');
  pdf.setFont('helvetica', 'normal');
  pdf.text(fmtDate(vr.createdAt instanceof Date ? vr.createdAt.toISOString().slice(0, 10) : String(vr.createdAt).slice(0, 10)), ml + lw, y);
  y += 6;

  pdf.setFontSize(9); pdf.setTextColor(55, 65, 81);
  pdf.text('Por medio de la presente, solicito tomar los siguientes días a cuenta de mis vacaciones correspondientes.', ml, y);
  y += 7;

  // Datos colaborador
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
  pdf.text('Datos del Colaborador', ml, y); y += 2; line(y); y += 5;
  pdf.setFontSize(13); pdf.setTextColor(17, 24, 39);
  pdf.text(vr.employeeName.toUpperCase(), ml, y); y += 5;
  pdf.setFontSize(9); pdf.setTextColor(30, 41, 59);
  pdf.text('Fecha de Ingreso: ', ml, y);
  const hw = pdf.getTextWidth('Fecha de Ingreso: ');
  pdf.setFont('helvetica', 'normal');
  pdf.text(fmtDate(vr.hireDate), ml + hw, y); y += 8;

  // Resumen - compact inline
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
  pdf.text('Resumen de Vacaciones', ml, y); y += 2; line(y); y += 6;
  const colW = cw / 3;
  [
    { label: 'Días Correspondientes', value: String(vr.daysEntitled) },
    { label: 'Días Solicitados', value: String(vr.daysRequested) },
    { label: 'Días Pendientes', value: String(Math.max(0, vr.daysEntitled - vr.daysRequested)) },
  ].forEach((item, i) => {
    const cx = ml + colW * i + colW / 2;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(107, 114, 128);
    pdf.text(item.label, cx, y, { align: 'center' });
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(17, 24, 39);
    pdf.text(item.value, cx, y + 6, { align: 'center' });
  });
  y += 14;

  // Periodo - 2 column grid
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
  pdf.text('Período Solicitado', ml, y); y += 2; line(y); y += 5;

  // Table header row
  pdf.setFillColor(245, 245, 245);
  const halfW = cw / 2;
  pdf.rect(ml, y - 2, cw, 6, 'F');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(75, 85, 99);
  pdf.text('#', ml + 2, y + 2);
  pdf.text('Fecha', ml + 8, y + 2);
  pdf.text('#', ml + halfW + 2, y + 2);
  pdf.text('Fecha', ml + halfW + 8, y + 2);
  y += 6; line(y); y += 1;

  // Dates in 2 columns
  const dates = vr.dates;
  const rows = Math.ceil(dates.length / 2);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(55, 65, 81);

  for (let r = 0; r < rows; r++) {
    y += 4;
    // Left column
    const idxL = r;
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(150, 150, 150);
    pdf.text(String(idxL + 1), ml + 2, y);
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(55, 65, 81);
    pdf.text(fmtDateShort(dates[idxL]), ml + 8, y);
    // Right column
    const idxR = r + rows;
    if (idxR < dates.length) {
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(150, 150, 150);
      pdf.text(String(idxR + 1), ml + halfW + 2, y);
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(55, 65, 81);
      pdf.text(fmtDateShort(dates[idxR]), ml + halfW + 8, y);
    }
    y += 1.5;
    pdf.setDrawColor(230, 230, 230); pdf.setLineWidth(0.15);
    pdf.line(ml, y, pageWidth - mr, y);
    y += 0.5;
  }
  y += 5;

  // Notas
  if (vr.notes) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
    pdf.text('Comentarios', ml, y); y += 2; line(y); y += 5;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(55, 65, 81);
    const nl = pdf.splitTextToSize(vr.notes, cw);
    nl.forEach((l: string) => { pdf.text(l, ml, y); y += 4; });
    y += 3;
  }

  // Disclaimer
  y += 2;
  pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(140, 140, 140);
  pdf.text('La presente solicitud está sujeta a la aprobación de la Dirección General y a la disponibilidad operativa del departamento.', pageWidth / 2, y, { align: 'center', maxWidth: cw });
  y += 10;

  // Firmas
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(55, 65, 81);
  pdf.text('Firmas de Autorización', pageWidth / 2, y, { align: 'center' }); y += 2; line(y); y += 25;
  const sigW = cw / 3;
  ['Firma del Solicitante', 'Dirección General', 'Administración'].forEach((label, i) => {
    const sx = ml + sigW * i;
    const sc = sx + sigW / 2;
    pdf.setDrawColor(156, 163, 175); pdf.setLineWidth(0.4);
    pdf.line(sx + 5, y, sx + sigW - 5, y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(75, 85, 99);
    pdf.text(label, sc, y + 4, { align: 'center' });
  });

  const nameParts = vr.employeeName.split(' ');
  const fileName = `vacaciones_${nameParts[0]}_${nameParts[1] || ''}.pdf`.replace(/\s/g, '_');
  pdf.save(fileName);
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

// --- Helper functions for day-specific schedule detection ---
const parseScheduleStartTime = (scheduleString: string): string | null => {
  if (!scheduleString || scheduleString.toLowerCase().includes('no labora')) {
    return null;
  }
  const parts = scheduleString.split('-');
  if (parts.length >= 1) {
    const startTime = parts[0].trim();
    if (/^\d{2}:\d{2}$/.test(startTime)) {
      return startTime;
    }
  }
  return null;
};

const findDetailedEmployee = (
  employeeName: string,
  detailedEmployees: DetailedEmployee[]
): DetailedEmployee | undefined => {
  const normalizedName = employeeName.toUpperCase().replace(/\s+/g, ' ').trim();

  const exactMatch = detailedEmployees.find(emp => {
    const fullName = `${emp.paterno} ${emp.materno} ${emp.nombres}`
      .toUpperCase().replace(/\s+/g, ' ').trim();
    return fullName === normalizedName;
  });
  if (exactMatch) return exactMatch;

  return detailedEmployees.find(emp =>
    normalizedName.includes(emp.paterno.toUpperCase()) &&
    normalizedName.includes(emp.nombres.toUpperCase())
  );
};

const getScheduleForDay = (employee: DetailedEmployee, dayOfWeek: number): string | null => {
  switch (dayOfWeek) {
    case 0: return null; // Domingo
    case 1: // Lunes
    case 2: // Martes
    case 3: // Miércoles
    case 5: // Viernes
      return parseScheduleStartTime(employee.horarioLunesMiercolesViernes);
    case 4: // Jueves
      return parseScheduleStartTime(employee.horarioJueves);
    case 6: // Sábado
      return parseScheduleStartTime(employee.horarioSabado);
    default: return null;
  }
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

const getScheduleInfoForDate = (emp: DetailedEmployee | undefined, dateStr?: string): { startMin: number; endMin: number; durationMin: number } => {
    const DEFAULT = { startMin: 9 * 60, endMin: 18 * 60, durationMin: 8 * 60 };
    if (!emp || !dateStr) return DEFAULT;

    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    if (day === 0) return { startMin: 0, endMin: 0, durationMin: 0 };

    let schedule = emp.horarioLunesMiercolesViernes || '09:00-18:00';
    if (day === 4) schedule = emp.horarioJueves || schedule;
    if (day === 6) schedule = emp.horarioSabado || schedule;

    if (schedule.toLowerCase().includes('no labora')) return { startMin: 0, endMin: 0, durationMin: 0 };

    const parts = schedule.split('-').map(s => s.trim());
    if (parts.length < 2) return DEFAULT;
    const [sh, sm] = parts[0].split(':').map(Number);
    const [eh, em] = parts[1].split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return DEFAULT;

    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    let durationMin = endMin - startMin;
    if (durationMin >= 420) durationMin -= 60;
    return { startMin, endMin, durationMin: Math.max(durationMin, 0) };
};

const calculateMinutesToCompensate = (req: PermissionRequest, emp?: DetailedEmployee): number => {
    const { permissionType, arrivalTime, departureTime, absenceStartTime, absenceEndTime } = req;

    switch (permissionType) {
        case PermissionType.FULL_DAYS: {
            if (req.dates && req.dates.length > 0) {
                return req.dates.reduce((total, dateStr) => {
                    const info = getScheduleInfoForDate(emp, dateStr);
                    return total + info.durationMin;
                }, 0);
            }
            const fallbackInfo = getScheduleInfoForDate(emp, req.permissionDate);
            return (req.daysCount || 0) * fallbackInfo.durationMin;
        }
        case PermissionType.LATE_ARRIVAL: {
            const info = getScheduleInfoForDate(emp, req.permissionDate);
            const arrival = timeToMinutes(arrivalTime);
            return arrival > info.startMin ? arrival - info.startMin : 0;
        }
        case PermissionType.EARLY_DEPARTURE: {
            const info = getScheduleInfoForDate(emp, req.permissionDate);
            const departure = timeToMinutes(departureTime);
            return departure < info.endMin ? info.endMin - departure : 0;
        }
        case PermissionType.PARTIAL_ABSENCE: {
            const start = timeToMinutes(absenceStartTime);
            const end = timeToMinutes(absenceEndTime);
            return end > start ? end - start : 0;
        }
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
  const toast = useToast();
  const { canEdit, isAdmin, isSupervisor, user, userData } = useAuth();
  const [detailedEmployees, setDetailedEmployees] = useState<DetailedEmployee[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const timeOptions = useMemo(() => generateTimeOptions(), []);
  
  const initialFormState: Omit<DetailedEmployee, 'id' | 'codigo' | 'horarioLunesMiercolesViernes' | 'horarioJueves' | 'horarioSabado' | 'firebaseUid'> = {
    email: '',
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

  // Vacaciones
  const [vacationRequests, setVacationRequests] = useState<VacationRequestRecord[]>([]);
  const [editingVacation, setEditingVacation] = useState<VacationRequestRecord | null>(null);
  const [editVacDates, setEditVacDates] = useState('');
  const [isVacationSectionVisible, setIsVacationSectionVisible] = useState(false);

  // Estado para edición de colaboradores
  const [editingEmployee, setEditingEmployee] = useState<DetailedEmployee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Estado para crear cuenta de acceso
  const [creatingAccountForId, setCreatingAccountForId] = useState<string | null>(null);

  // Estado para restablecer contraseña
  const [resettingPasswordForId, setResettingPasswordForId] = useState<string | null>(null);

  // Estado para bloqueo/desbloqueo de usuario
  const [togglingActiveForId, setTogglingActiveForId] = useState<string | null>(null);

  // Estado para edición de logs de asistencia
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [isLogEditModalOpen, setIsLogEditModalOpen] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [editLogDate, setEditLogDate] = useState('');
  const [editLogTime, setEditLogTime] = useState('');
  
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
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  // Estado para gestion de retardos
  const [tardinessAdjustments, setTardinessAdjustments] = useState<TardinessAdjustment[]>([]);
  const [editingTardiness, setEditingTardiness] = useState<{key: string; minutes: number; sanction: boolean; reason: string; isAuthorized: boolean} | null>(null);
  const [tardinessStartDate, setTardinessStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 15);
    return d.toISOString().slice(0, 10);
  });
  const [tardinessEndDate, setTardinessEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Estado para mensajes motivacionales
  const [motivationalEnabled, setMotivationalEnabled] = useState(true);
  const [togglingMotivational, setTogglingMotivational] = useState(false);

  // Estado para tolerancia configurable
  const [toleranceMinutes, setToleranceMinutes] = useState(10);
  const [editingTolerance, setEditingTolerance] = useState(false);
  const [tempTolerance, setTempTolerance] = useState(10);
  const [savingTolerance, setSavingTolerance] = useState(false);

  useEffect(() => {
    // Suscribirse a cambios en tiempo real desde Firestore
    const unsubscribeLogs = logsService.subscribe((logs) => {
      setAllLogs(logs);
    });

    const unsubscribeEmployees = employeesService.subscribe((employees) => {
      setDetailedEmployees(employees);
    });

    const unsubscribePermissions = permissionsService.subscribe((requests) => {
      setPermissionRequests(requests);
    });

    const unsubscribeTardiness = tardinessService.subscribe((adjustments) => {
      setTardinessAdjustments(adjustments);
    });

    const unsubscribeMotivational = motivationalService.subscribe((settings) => {
      setMotivationalEnabled(settings.enabled);
    });

    const unsubscribeTolerance = toleranceService.subscribe((settings) => {
      setToleranceMinutes(settings.minutes);
      setTempTolerance(settings.minutes);
    });

    const unsubscribeVacations = vacationRequestsService.subscribe((reqs) => {
      setVacationRequests(reqs);
    });

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      unsubscribeLogs();
      unsubscribeEmployees();
      unsubscribePermissions();
      unsubscribeTardiness();
      unsubscribeMotivational();
      unsubscribeTolerance();
      unsubscribeVacations();
    };
  }, []);

  const calculatedOwedHours = useMemo(() => {
    const owedMinutes: { [key: string]: number } = {};
    const compensatedMinutes: { [key: string]: number } = {};

    // 1. Calcular minutos totales a reponer por empleado
    const approvedExtraTime = permissionRequests.filter(req =>
        req.compensation === Compensation.EXTRA_TIME &&
        req.adminApproval?.status === 'aprobado'
    );

    approvedExtraTime.forEach(req => {
        const employeeFullName = `${req.lastName} ${req.motherLastName} ${req.firstName}`.toUpperCase().replace(/\s+/g, ' ').trim();
        const detailedEmp = findDetailedEmployee(employeeFullName, detailedEmployees);
        const minutes = calculateMinutesToCompensate(req, detailedEmp);
        owedMinutes[employeeFullName] = (owedMinutes[employeeFullName] || 0) + minutes;
    });

    // 2. Calcular minutos ya compensados desde logs reales
    approvedExtraTime.forEach(req => {
        if (!req.compensationStartDate || !req.compensationMethod) return;
        const employeeFullName = `${req.lastName} ${req.motherLastName} ${req.firstName}`.toUpperCase().replace(/\s+/g, ' ').trim();
        const detailedEmp = findDetailedEmployee(employeeFullName, detailedEmployees);
        if (!detailedEmp) return;

        const startDate = new Date(req.compensationStartDate + 'T00:00:00');
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const cursor = new Date(startDate);
        while (cursor <= today) {
            const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
            const schedInfo = getScheduleInfoForDate(detailedEmp, dateStr);

            if (schedInfo.durationMin > 0) {
                const dayStart = new Date(cursor).setHours(0, 0, 0, 0);
                const dayEnd = dayStart + 86400000;
                const dayLogs = allLogs.filter(log =>
                    log.timestamp >= dayStart && log.timestamp < dayEnd && (
                        (log.employeeCode && log.employeeCode === detailedEmp.codigo) ||
                        log.employeeName.toUpperCase().trim() === employeeFullName
                    )
                );

                if (req.compensationMethod === CompensationMethod.ARRIVE_EARLIER) {
                    const entrada = dayLogs.find(l => l.type === LogType.ENTRADA);
                    if (entrada) {
                        const d = new Date(entrada.timestamp);
                        const arrivalMin = d.getHours() * 60 + d.getMinutes();
                        if (arrivalMin < schedInfo.startMin) {
                            compensatedMinutes[employeeFullName] = (compensatedMinutes[employeeFullName] || 0) + (schedInfo.startMin - arrivalMin);
                        }
                    }
                } else {
                    const salida = [...dayLogs].filter(l => l.type === LogType.SALIDA).pop();
                    if (salida) {
                        const d = new Date(salida.timestamp);
                        const departMin = d.getHours() * 60 + d.getMinutes();
                        if (departMin > schedInfo.endMin) {
                            compensatedMinutes[employeeFullName] = (compensatedMinutes[employeeFullName] || 0) + (departMin - schedInfo.endMin);
                        }
                    }
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }
    });

    // 3. Restar compensado del adeudado
    const result: { [key: string]: number } = {};
    for (const empName in owedMinutes) {
        const remaining = Math.max(0, owedMinutes[empName] - (compensatedMinutes[empName] || 0));
        result[empName] = remaining / 60;
    }

    return result;
  }, [permissionRequests, detailedEmployees, allLogs]);

  const filteredLogs = useMemo(() => {
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(23, 59, 59, 999);
    return allLogs.filter(log => log.timestamp >= start && log.timestamp <= end);
  }, [allLogs, startDate, endDate]);

  const getEffectiveScheduleTime = useCallback((employeeName: string, timestamp: number): string => {
    const logDate = new Date(timestamp);
    const dayOfWeek = logDate.getDay();

    // 1. Buscar en DetailedEmployee (horarios por día)
    const detailedEmp = findDetailedEmployee(employeeName, detailedEmployees);
    if (detailedEmp) {
      const daySchedule = getScheduleForDay(detailedEmp, dayOfWeek);
      if (daySchedule === null) {
        return ''; // "No labora" o domingo
      }
      return daySchedule;
    }

    // 2. Fallback: EMPLOYEES constant (legacy)
    const legacyEmployee = EMPLOYEES.find(e => e.name === employeeName);
    if (legacyEmployee) {
      return legacyEmployee.scheduleStartTime;
    }

    return '09:00';
  }, [detailedEmployees]);

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

      const toleranceDeadline = new Date(scheduleDate.getTime() + toleranceMinutes * 60 * 1000);
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

  const handleCleanDuplicates = async () => {
    const confirm = window.confirm(
      '¿Estás seguro de que deseas limpiar los registros duplicados?\n\n' +
      'Esta acción eliminará los registros de asistencia duplicados en la base de datos.'
    );
    if (!confirm) return;

    setIsCleaningDuplicates(true);
    try {
      const result = await cleanDuplicateLogs();
      if (result.deleted > 0) {
        toast.success(`Limpieza completada. ${result.deleted} registros duplicados eliminados.`);
      } else {
        toast.info('No se encontraron registros duplicados.');
      }
    } catch (error) {
      console.error('Error al limpiar duplicados:', error);
      toast.error('Error al limpiar duplicados. Revisa la consola para más detalles.');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegisterEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newEmployee.nombres || !newEmployee.paterno || !newEmployee.fechaNacimiento || !newEmployee.email) {
      toast.warning('Nombre(s), Apellido Paterno, Fecha de Cumpleaños y Email son obligatorios.');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmployee.email)) {
      toast.warning('Por favor ingresa un email válido.');
      return;
    }

    setIsRegistering(true);

    try {
      // Obtener empleados existentes desde Firestore
      const existingEmployees = await employeesService.getAll();

      // Verificar si el email ya existe en detailed_employees
      if (existingEmployees.some(emp => emp.email === newEmployee.email)) {
        toast.error('Ya existe un colaborador con este email en el panel.');
        setIsRegistering(false);
        return;
      }

      const [year, month, day] = newEmployee.fechaNacimiento.split('-');
      const baseCode = `${day}${month}${year.slice(-2)}`;

      let employeeCode = baseCode;
      let counter = 1;
      while (existingEmployees.some(emp => emp.codigo === employeeCode)) {
          employeeCode = `${baseCode}-${counter}`;
          counter++;
      }

      // Verificar si el email ya existe en Firebase Auth
      const signInMethods = await fetchSignInMethodsForEmail(auth, newEmployee.email);

      let firebaseUid: string | undefined = undefined;
      let accountLinked = false;

      if (signInMethods.length > 0) {
        // El email ya existe en Firebase Auth - preguntar si vincular
        const confirmLink = window.confirm(
          `El email ${newEmployee.email} ya existe en el sistema de autenticación.\n\n` +
          `¿Deseas vincular este colaborador con la cuenta existente?\n\n` +
          `Si eliges "Aceptar", el colaborador se registrará y se vinculará a su cuenta.\n` +
          `Puedes enviarle un email de restablecimiento de contraseña después.`
        );

        if (!confirmLink) {
          setIsRegistering(false);
          return;
        }

        // Buscar el UID existente en Firestore
        const usersQuery = query(collection(db, 'users'), where('email', '==', newEmployee.email));
        const querySnapshot = await getDocs(usersQuery);

        if (!querySnapshot.empty) {
          firebaseUid = querySnapshot.docs[0].id;
          accountLinked = true;
        } else {
          // No hay documento en Firestore, el usuario existe en Auth pero sin perfil
          // El colaborador se registrará sin firebaseUid y podrá vincularse después
          accountLinked = false;
        }
      } else {
        // El email no existe - crear cuenta nueva
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          newEmployee.email,
          employeeCode // El código de 6 dígitos es la contraseña
        );

        // Crear documento en Firestore con rol 'employee'
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: newEmployee.email,
          role: 'employee',
          displayName: `${newEmployee.nombres} ${newEmployee.paterno}`,
          createdAt: new Date(),
        });

        firebaseUid = userCredential.user.uid;
      }

      const finalHorarioLMV = `${scheduleForm.lunesMiercolesViernesEntrada} - ${scheduleForm.lunesMiercolesViernesSalida}`;
      const finalHorarioJueves = scheduleForm.juevesTrabaja === 'si'
          ? `${scheduleForm.juevesEntrada} - ${scheduleForm.juevesSalida}`
          : 'No labora';
      const finalHorarioSab = scheduleForm.sabadoTrabaja === 'si'
          ? `${scheduleForm.sabEntrada} - ${scheduleForm.sabSalida}`
          : 'No labora';

      const newEmployeeData = {
        codigo: employeeCode,
        email: newEmployee.email,
        firebaseUid: firebaseUid,
        paterno: newEmployee.paterno,
        materno: newEmployee.materno,
        nombres: newEmployee.nombres,
        fechaIngreso: newEmployee.fechaIngreso,
        fechaNacimiento: newEmployee.fechaNacimiento,
        curp: newEmployee.curp,
        rfc: newEmployee.rfc,
        nss: newEmployee.nss,
        departamento: newEmployee.departamento,
        puesto: newEmployee.puesto,
        horarioLunesMiercolesViernes: finalHorarioLMV,
        horarioJueves: finalHorarioJueves,
        horarioSabado: finalHorarioSab,
        bonoPuntualidad: Number(newEmployee.bonoPuntualidad),
        bonoObjetivos: Number(newEmployee.bonoObjetivos),
        apoyoGasolina: Number(newEmployee.apoyoGasolina),
      };

      // Guardar en Firestore (el servicio también actualiza localStorage)
      await employeesService.create(newEmployeeData);
      // La suscripción actualizará automáticamente detailedEmployees

      // Mostrar mensaje según el caso
      if (accountLinked) {
        toast.success(`Colaborador ${newEmployee.nombres} ${newEmployee.paterno} registrado y vinculado exitosamente. Código: ${employeeCode}`);
      } else if (firebaseUid) {
        toast.success(`Colaborador ${newEmployee.nombres} ${newEmployee.paterno} registrado exitosamente. Contraseña: ${employeeCode}`);
      } else {
        toast.info(`Colaborador ${newEmployee.nombres} ${newEmployee.paterno} registrado. El email existe en Auth pero sin perfil vinculado. Use "Crear cuenta" después.`);
      }

      setNewEmployee(initialFormState);
      setScheduleForm(initialScheduleState);
    } catch (error: any) {
      console.error('Error al registrar colaborador:', error);
      if (error.code === 'auth/email-already-in-use') {
        // El email ya existe en Firebase Auth - ofrecer vincular
        const confirmLink = window.confirm(
          `El email ${newEmployee.email} ya existe en el sistema de autenticación.\n\n` +
          `¿Deseas registrar este colaborador y vincularlo con la cuenta existente?\n\n` +
          `Si eliges "Aceptar", el colaborador se registrará sin crear cuenta nueva.\n` +
          `Puedes enviarle un email de restablecimiento de contraseña después.`
        );

        if (confirmLink) {
          try {
            // Obtener empleados existentes desde Firestore
            const existingEmployees = await employeesService.getAll();

            // Generar código
            const [year, month, day] = newEmployee.fechaNacimiento.split('-');
            const baseCode = `${day}${month}${year.slice(-2)}`;
            let employeeCode = baseCode;
            let counter = 1;
            while (existingEmployees.some(emp => emp.codigo === employeeCode)) {
              employeeCode = `${baseCode}-${counter}`;
              counter++;
            }

            // Buscar el UID existente en Firestore
            let firebaseUid: string | undefined = undefined;
            const usersQuery = query(collection(db, 'users'), where('email', '==', newEmployee.email));
            const querySnapshot = await getDocs(usersQuery);

            if (!querySnapshot.empty) {
              firebaseUid = querySnapshot.docs[0].id;
            }

            // Preparar horarios
            const finalHorarioLMV = `${scheduleForm.lunesMiercolesViernesEntrada} - ${scheduleForm.lunesMiercolesViernesSalida}`;
            const finalHorarioJueves = scheduleForm.juevesTrabaja === 'si'
              ? `${scheduleForm.juevesEntrada} - ${scheduleForm.juevesSalida}`
              : 'No labora';
            const finalHorarioSab = scheduleForm.sabadoTrabaja === 'si'
              ? `${scheduleForm.sabEntrada} - ${scheduleForm.sabSalida}`
              : 'No labora';

            // Crear registro del empleado SIN crear cuenta en Firebase Auth
            const newEmployeeData = {
              codigo: employeeCode,
              email: newEmployee.email,
              firebaseUid: firebaseUid,
              paterno: newEmployee.paterno,
              materno: newEmployee.materno,
              nombres: newEmployee.nombres,
              fechaIngreso: newEmployee.fechaIngreso,
              fechaNacimiento: newEmployee.fechaNacimiento,
              curp: newEmployee.curp,
              rfc: newEmployee.rfc,
              nss: newEmployee.nss,
              departamento: newEmployee.departamento,
              puesto: newEmployee.puesto,
              horarioLunesMiercolesViernes: finalHorarioLMV,
              horarioJueves: finalHorarioJueves,
              horarioSabado: finalHorarioSab,
              bonoPuntualidad: Number(newEmployee.bonoPuntualidad),
              bonoObjetivos: Number(newEmployee.bonoObjetivos),
              apoyoGasolina: Number(newEmployee.apoyoGasolina),
            };

            // Guardar en Firestore
            await employeesService.create(newEmployeeData);

            toast.success(`Colaborador ${newEmployee.nombres} ${newEmployee.paterno} registrado y vinculado exitosamente. Código: ${employeeCode}`);

            setNewEmployee(initialFormState);
            setScheduleForm(initialScheduleState);
          } catch (linkError: any) {
            console.error('Error al vincular cuenta existente:', linkError);
            toast.error(`Error al vincular: ${linkError.message}`);
          }
        }
      } else if (error.code === 'auth/weak-password') {
        toast.warning('El código generado es muy débil. Contacta al administrador del sistema.');
      } else {
        toast.error(`Error al registrar: ${error.message}`);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // Función para abrir modal de edición
  const handleEditEmployee = (employee: DetailedEmployee) => {
    setEditingEmployee({ ...employee });
    setIsEditModalOpen(true);
  };

  // Función para guardar cambios de edición
  const handleSaveEdit = async () => {
    if (!editingEmployee) return;

    setIsSavingEdit(true);
    try {
      // Actualizar en Firestore
      await employeesService.update(editingEmployee.id, editingEmployee);

      // Si el colaborador tiene cuenta Firebase, actualizar en Firestore users
      if (editingEmployee.firebaseUid) {
        await setDoc(doc(db, 'users', editingEmployee.firebaseUid), {
          displayName: `${editingEmployee.nombres} ${editingEmployee.paterno}`,
          email: editingEmployee.email,
        }, { merge: true });
      }

      toast.success('Colaborador actualizado exitosamente.');
      setIsEditModalOpen(false);
      setEditingEmployee(null);
    } catch (error: any) {
      console.error('Error al actualizar colaborador:', error);
      toast.error(`Error al actualizar: ${error.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Función para eliminar colaborador
  const handleDeleteEmployee = async (employee: DetailedEmployee) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas dar de baja a ${employee.nombres} ${employee.paterno}?\n\n` +
      `Esta acción eliminará al colaborador del sistema.`
    );

    if (!confirmDelete) return;

    try {
      // Eliminar de Firestore
      await employeesService.delete(employee.id);

      // Nota: No eliminamos la cuenta de Firebase Auth por seguridad
      // El admin puede desactivarla desde la consola de Firebase si es necesario

      toast.success(`Colaborador ${employee.nombres} ${employee.paterno} dado de baja exitosamente.`);
    } catch (error: any) {
      console.error('Error al eliminar colaborador:', error);
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  // Función para vincular empleado con cuenta Firebase existente
  const handleLinkExistingAccount = async (employee: DetailedEmployee) => {
    if (!employee.email) return;

    setCreatingAccountForId(employee.id);

    try {
      // Buscar el usuario en Firestore por email
      const usersQuery = query(collection(db, 'users'), where('email', '==', employee.email));
      const querySnapshot = await getDocs(usersQuery);

      if (!querySnapshot.empty) {
        // Usuario encontrado en Firestore - vincular con ese UID
        const existingUser = querySnapshot.docs[0];
        const uid = existingUser.id;

        // Actualizar el registro del empleado con el firebaseUid en Firestore
        await employeesService.update(employee.id, { firebaseUid: uid });

        toast.success(`Cuenta vinculada exitosamente. ${employee.nombres} ${employee.paterno} ha sido vinculado a su cuenta existente.`);
      } else {
        // No hay documento en Firestore pero sí en Auth
        // Crear documento en Firestore (se creará cuando el usuario inicie sesión)
        toast.info('El email existe en Firebase Auth pero no tiene perfil en Firestore. El colaborador debe iniciar sesión para completar su perfil.');
      }
    } catch (error: any) {
      console.error('Error al vincular cuenta:', error);
      toast.error(`Error al vincular cuenta: ${error.message}`);
    } finally {
      setCreatingAccountForId(null);
    }
  };

  // Función para crear cuenta de acceso para empleados existentes
  const handleCreateAccount = async (employee: DetailedEmployee) => {
    // Validar que tenga email
    if (!employee.email) {
      toast.error('Este colaborador no tiene email registrado. Por favor, edita el registro y agrega un email primero.');
      return;
    }

    // Validar que no tenga cuenta ya
    if (employee.firebaseUid) {
      toast.info('Este colaborador ya tiene una cuenta de acceso activa.');
      return;
    }

    setCreatingAccountForId(employee.id);

    try {
      // Primero verificar si el email ya existe en Firebase Auth
      const signInMethods = await fetchSignInMethodsForEmail(auth, employee.email);

      if (signInMethods.length > 0) {
        // El email ya existe - preguntar si quiere vincular
        setCreatingAccountForId(null);

        const confirmLink = window.confirm(
          `El email ${employee.email} ya existe en el sistema de autenticación.\n\n` +
          `¿Deseas vincular este colaborador con la cuenta existente?\n\n` +
          `Si eliges "Aceptar", el colaborador podrá usar su cuenta actual.\n` +
          `Puedes enviarle un email de restablecimiento de contraseña después.`
        );

        if (confirmLink) {
          await handleLinkExistingAccount(employee);
        }
        return;
      }

      // El email no existe - proceder a crear cuenta nueva
      const confirmCreate = window.confirm(
        `¿Crear cuenta de acceso para ${employee.nombres} ${employee.paterno}?\n\n` +
        `Email: ${employee.email}\n` +
        `Contraseña: ${employee.codigo} (código de 6 dígitos)\n\n` +
        `El colaborador podrá iniciar sesión con estas credenciales.`
      );

      if (!confirmCreate) {
        setCreatingAccountForId(null);
        return;
      }

      // Crear cuenta en Firebase Auth con el código como contraseña
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        employee.email,
        employee.codigo // El código de 6 dígitos es la contraseña
      );

      // Crear documento en Firestore con rol 'employee'
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: employee.email,
        role: 'employee',
        displayName: `${employee.nombres} ${employee.paterno}`,
        createdAt: new Date(),
      });

      // Actualizar el registro del empleado con el firebaseUid en Firestore
      await employeesService.update(employee.id, { firebaseUid: userCredential.user.uid });

      toast.success(`Cuenta creada exitosamente para ${employee.nombres} ${employee.paterno}. Contraseña: ${employee.codigo}`);
    } catch (error: any) {
      console.error('Error al crear cuenta:', error);
      if (error.code === 'auth/email-already-in-use') {
        // Esto no debería pasar ahora, pero por si acaso
        const confirmLink = window.confirm(
          `El email ya está registrado.\n\n` +
          `¿Deseas vincular este colaborador con la cuenta existente?`
        );
        if (confirmLink) {
          await handleLinkExistingAccount(employee);
        }
      } else if (error.code === 'auth/weak-password') {
        toast.warning('El código es muy corto para ser una contraseña segura. Firebase requiere mínimo 6 caracteres.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('El email no es válido. Por favor, verifica el formato.');
      } else {
        toast.error(`Error al crear cuenta: ${error.message}`);
      }
    } finally {
      setCreatingAccountForId(null);
    }
  };

  // Función para restablecer contraseña de un empleado
  const handleResetPassword = async (employee: DetailedEmployee) => {
    if (!employee.email) {
      toast.error('Este colaborador no tiene email registrado.');
      return;
    }

    const confirmReset = window.confirm(
      `¿Enviar email de restablecimiento de contraseña a ${employee.nombres} ${employee.paterno}?\n\n` +
      `Se enviará un correo a: ${employee.email}\n\n` +
      `El colaborador recibirá un enlace para crear una nueva contraseña.`
    );

    if (!confirmReset) return;

    setResettingPasswordForId(employee.id);

    try {
      await sendPasswordResetEmail(auth, employee.email);

      // Registrar la fecha del restablecimiento en el empleado
      const resetDate = new Date().toISOString();
      await employeesService.update(employee.id, { lastPasswordReset: resetDate });

      // Actualizar estado local
      setDetailedEmployees(prev =>
        prev.map(emp => emp.id === employee.id ? { ...emp, lastPasswordReset: resetDate } : emp)
      );

      toast.success(`Email enviado exitosamente a ${employee.email}. El colaborador debe revisar su bandeja de entrada.`);
    } catch (error: unknown) {
      console.error('Error al enviar email de restablecimiento:', error);
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code === 'auth/user-not-found') {
        toast.error('No existe una cuenta con este email. Primero debes crear la cuenta de acceso.');
      } else if (firebaseError.code === 'auth/invalid-email') {
        toast.error('El email no es válido.');
      } else {
        toast.error(`Error al enviar email: ${firebaseError.message || 'Error desconocido'}`);
      }
    } finally {
      setResettingPasswordForId(null);
    }
  };

  const handleToggleActive = async (employee: DetailedEmployee) => {
    const isCurrentlyActive = employee.activo !== false;
    const action = isCurrentlyActive ? 'Bloquear' : 'Reactivar';
    const fullName = `${employee.nombres} ${employee.paterno} ${employee.materno}`;

    let isAdminUser = false;
    if (employee.firebaseUid) {
      const userSnap = await getDoc(doc(db, 'users', employee.firebaseUid));
      if (userSnap.exists() && userSnap.data()?.role === 'admin') isAdminUser = true;
    }

    if (isCurrentlyActive) {
      const msg = isAdminUser
        ? `¿Dar de baja de nómina a ${fullName}?\n\nSolo se excluirá de nómina y checador.\nConservará acceso a la plataforma como administrador.`
        : `¿${action} el acceso de ${fullName}?\n\nMotivo: Renuncia / Baja\n\nEl colaborador perderá acceso inmediato a la plataforma.\nSus registros históricos se conservarán.`;
      if (!window.confirm(msg)) return;
    } else {
      if (!window.confirm(`¿Reactivar a ${fullName}?\n\nVolverá a aparecer en nómina y checador.`)) return;
    }

    setTogglingActiveForId(employee.id);

    try {
      if (isCurrentlyActive) {
        await employeesService.update(employee.id, {
          activo: false,
          fechaBaja: new Date().toISOString().slice(0, 10),
          motivoBaja: 'Renuncia',
        });
      } else {
        const empRef = doc(db, 'detailed_employees', employee.id);
        await setDoc(empRef, { activo: true, fechaBaja: deleteField(), motivoBaja: deleteField() }, { merge: true });
      }

      if (employee.firebaseUid && !isAdminUser) {
        const userRef = doc(db, 'users', employee.firebaseUid);
        await setDoc(userRef, { activo: isCurrentlyActive ? false : true }, { merge: true });
      }

      toast.success(
        isCurrentlyActive
          ? (isAdminUser
              ? `${fullName} dado de baja de nómina. Conserva acceso como administrador.`
              : `${fullName} ha sido dado de baja. Ya no podrá acceder a la plataforma.`)
          : `${fullName} ha sido reactivado exitosamente.`
      );
    } catch (error: unknown) {
      console.error('Error al cambiar estado del colaborador:', error);
      toast.error('Error al cambiar el estado del colaborador.');
    } finally {
      setTogglingActiveForId(null);
    }
  };

  // Función para manejar cambios en el formulario de edición
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingEmployee) return;
    const { name, value, type } = e.target;
    setEditingEmployee({
      ...editingEmployee,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    });
  };

  // Funciones para edición de logs de asistencia
  // Flujo de aprobacion de permisos (2 pasos: supervisor → admin)
  const handlePermissionDecision = async (
    requestId: string,
    decision: 'aprobado' | 'denegado'
  ) => {
    const userEmail = user?.email || '';
    const userName = userData?.displayName || userData?.email || '';

    try {
      if (isSupervisor) {
        await permissionsService.supervisorDecision(requestId, decision, userEmail, userName);
        toast.success(decision === 'aprobado' ? 'Permiso aprobado por supervisor.' : 'Permiso denegado por supervisor.');
      } else if (isAdmin) {
        // Admin puede aprobar en cualquier paso
        const req = permissionRequests.find(r => r.id === requestId);
        const supervisorDone = req?.supervisorApproval?.status === 'aprobado';

        if (!supervisorDone) {
          // Si supervisor no ha aprobado, admin actua como supervisor primero
          await permissionsService.supervisorDecision(requestId, decision, userEmail, userName);
          if (decision === 'aprobado') {
            toast.success('Aprobado como supervisor. Falta aprobacion de admin.');
          } else {
            toast.success('Permiso denegado.');
          }
        } else {
          // Supervisor ya aprobo, admin da aprobacion final
          await permissionsService.adminDecision(requestId, decision, userEmail, userName);
          toast.success(decision === 'aprobado' ? 'Permiso aprobado definitivamente.' : 'Permiso denegado por admin.');
        }
      }
    } catch (error) {
      console.error('Error al procesar decision:', error);
      toast.error('Error al procesar la decision.');
    }
  };

  const handleEditLog = (log: LogEntry) => {
    setEditingLog({ ...log });
    // Convertir timestamp a fecha y hora
    const date = new Date(log.timestamp);
    setEditLogDate(date.toISOString().slice(0, 10));
    setEditLogTime(date.toTimeString().slice(0, 5));
    setIsLogEditModalOpen(true);
  };

  const handleDeleteLog = async (log: LogEntry) => {
    if (!log.id) {
      toast.error('Este registro no tiene ID y no puede ser eliminado.');
      return;
    }

    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar este registro?\n\n` +
      `Colaborador: ${log.employeeName}\n` +
      `Tipo: ${log.type}\n` +
      `Fecha: ${new Date(log.timestamp).toLocaleString('es-MX')}\n\n` +
      `Esta acción no se puede deshacer.`
    );

    if (!confirmDelete) return;

    try {
      await logsService.delete(log.id);
      toast.success('Registro eliminado exitosamente.');
    } catch (error: any) {
      console.error('Error al eliminar registro:', error);
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  const handleSaveLogEdit = async () => {
    if (!editingLog || !editingLog.id) {
      toast.error('No se puede guardar: el registro no tiene ID.');
      return;
    }

    setIsSavingLog(true);
    try {
      // Construir el nuevo timestamp desde fecha y hora
      const [year, month, day] = editLogDate.split('-').map(Number);
      const [hours, minutes] = editLogTime.split(':').map(Number);
      const newTimestamp = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();

      await logsService.update(editingLog.id, {
        employeeName: editingLog.employeeName,
        type: editingLog.type,
        timestamp: newTimestamp,
        ...(editingLog.location ? { location: editingLog.location } : {}),
      });

      toast.success('Registro actualizado exitosamente.');
      setIsLogEditModalOpen(false);
      setEditingLog(null);
    } catch (error: any) {
      console.error('Error al actualizar registro:', error);
      toast.error(`Error al actualizar: ${error.message}`);
    } finally {
      setIsSavingLog(false);
    }
  };

  const handleDownloadEmployeesCSV = () => {
    if (detailedEmployees.length === 0) {
        toast.info('No hay colaboradores registrados para descargar.');
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

  // ========== RETARDOS: calcular desde allLogs con filtro propio ==========
  const tardinessFilteredLogs = useMemo(() => {
    const start = new Date(tardinessStartDate + 'T00:00:00').getTime();
    const end = new Date(tardinessEndDate + 'T23:59:59').getTime();
    return allLogs.filter(log => log.timestamp >= start && log.timestamp <= end);
  }, [allLogs, tardinessStartDate, tardinessEndDate]);

  const tardinessData = useMemo(() => {
    const result: { employeeName: string; date: string; minutesLate: number; scheduleTime: string; checkInTime: string }[] = [];
    const grouped: { [key: string]: LogEntry[] } = {};

    tardinessFilteredLogs.forEach(log => {
      const date = new Date(log.timestamp).toISOString().slice(0, 10);
      const key = `${log.employeeName}__${date}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(log);
    });

    for (const key in grouped) {
      const [employeeName, date] = key.split('__');
      const dailyLogs = grouped[key].sort((a, b) => a.timestamp - b.timestamp);
      const checkIn = dailyLogs.find(l => l.type === LogType.ENTRADA);

      if (checkIn) {
        const scheduleTime = getEffectiveScheduleTime(employeeName, checkIn.timestamp);
        if (scheduleTime) {
          const checkInDate = new Date(checkIn.timestamp);
          const [h, m] = scheduleTime.split(':').map(Number);
          const schedDate = new Date(checkInDate);
          schedDate.setHours(h, m, 0, 0);
          const tolerance = new Date(schedDate.getTime() + toleranceMinutes * 60 * 1000);

          if (checkInDate > tolerance) {
            const minutesLate = Math.round((checkInDate.getTime() - schedDate.getTime()) / 60000);
            result.push({
              employeeName,
              date,
              minutesLate,
              scheduleTime,
              checkInTime: checkInDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            });
          }
        }
      }
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [tardinessFilteredLogs, getEffectiveScheduleTime]);

  // Retardos en ultimos 15 dias (para decidir si mostrar mensaje motivacional)
  const hasRecentTardiness = useMemo(() => {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const cutoff = fifteenDaysAgo.toISOString().slice(0, 10);
    // Buscar en allLogs, no en los filtrados
    const recentLogs = allLogs.filter(log => {
      const logDate = new Date(log.timestamp).toISOString().slice(0, 10);
      return logDate >= cutoff && log.type === LogType.ENTRADA;
    });
    for (const log of recentLogs) {
      const scheduleTime = getEffectiveScheduleTime(log.employeeName, log.timestamp);
      if (scheduleTime) {
        const checkInDate = new Date(log.timestamp);
        const [h, m] = scheduleTime.split(':').map(Number);
        const schedDate = new Date(checkInDate);
        schedDate.setHours(h, m, 0, 0);
        const tolerance = new Date(schedDate.getTime() + toleranceMinutes * 60 * 1000);
        if (checkInDate > tolerance) return true;
      }
    }
    return false;
  }, [allLogs, getEffectiveScheduleTime]);

  // Obtener ajuste existente para un retardo
  const getAdjustment = useCallback((employeeName: string, date: string) => {
    const key = `${employeeName}__${date}`.replace(/\s+/g, '_');
    return tardinessAdjustments.find(a => a.id === key);
  }, [tardinessAdjustments]);

  // Guardar ajuste de retardo
  const handleSaveTardinessAdjustment = async (employeeName: string, date: string, originalMinutes: number) => {
    if (!editingTardiness) return;
    try {
      await tardinessService.upsert(employeeName, date, {
        employeeName,
        date,
        originalMinutesLate: originalMinutes,
        adjustedMinutesLate: editingTardiness.isAuthorized ? 0 : editingTardiness.minutes,
        hasSanction: editingTardiness.isAuthorized ? false : editingTardiness.sanction,
        isAuthorized: editingTardiness.isAuthorized,
        reason: editingTardiness.reason,
        adjustedBy: user?.email || 'admin',
      });
      toast.success('Ajuste de retardo guardado.');
      setEditingTardiness(null);
    } catch {
      toast.error('Error al guardar ajuste.');
    }
  };

  // Guardar tolerancia
  const handleSaveTolerance = async () => {
    if (tempTolerance < 0 || tempTolerance > 60) {
      toast.warning('La tolerancia debe ser entre 0 y 60 minutos.');
      return;
    }
    setSavingTolerance(true);
    try {
      await toleranceService.setMinutes(tempTolerance, user?.email || 'admin');
      toast.success(`Tolerancia actualizada a ${tempTolerance} minutos.`);
      setEditingTolerance(false);
    } catch {
      toast.error('Error al guardar tolerancia.');
    } finally {
      setSavingTolerance(false);
    }
  };

  // Toggle mensajes motivacionales
  const handleToggleMotivational = async () => {
    setTogglingMotivational(true);
    try {
      await motivationalService.setEnabled(!motivationalEnabled, user?.email || 'admin');
      toast.success(motivationalEnabled ? 'Mensajes motivacionales desactivados.' : 'Mensajes motivacionales activados.');
    } catch {
      toast.error('Error al cambiar configuracion.');
    } finally {
      setTogglingMotivational(false);
    }
  };

  // Generar mensaje motivacional del dia (basado en fecha para que sea diferente cada dia)
  const dailyMotivationalMessage = useMemo(() => {
    const messages = [
      { title: 'La puntualidad es respeto', body: 'Llegar a tiempo demuestra respeto por tu equipo y por tu propio trabajo. Cada minuto cuenta para construir un ambiente profesional.' },
      { title: 'El exito comienza temprano', body: 'Las personas exitosas tienen algo en comun: valoran el tiempo. Ser puntual te da ventaja para organizar tu dia y ser mas productivo.' },
      { title: 'Tu compromiso se nota', body: 'Cuando llegas puntual, envias un mensaje claro: eres confiable, responsable y comprometido con la empresa. Tu equipo lo aprecia.' },
      { title: 'Cada minuto importa', body: 'Un minuto de retraso puede parecer poco, pero multiplicado por el equipo y los dias, representa horas perdidas. Se parte de la solucion.' },
      { title: 'La disciplina abre puertas', body: 'La puntualidad es una forma de disciplina que habla de tu caracter. Los lideres se forman con habitos consistentes dia a dia.' },
      { title: 'Respeta tu tiempo y el de los demas', body: 'Tu tiempo es valioso, y el de tus companeros tambien. Llegar a tiempo es la forma mas simple de mostrar profesionalismo.' },
      { title: 'Comienza el dia con el pie derecho', body: 'Llegar temprano te permite prepararte, tomar un cafe tranquilo y empezar el dia sin estres. Es un regalo que te das a ti mismo.' },
      { title: 'La confianza se construye con constancia', body: 'Cada dia que llegas a tiempo estas construyendo tu reputacion. La confianza se gana con acciones repetidas, no con palabras.' },
      { title: 'Se el ejemplo que inspira', body: 'Tu puntualidad puede motivar a otros. Se el companero que llega primero y marca la pauta para todo el equipo.' },
      { title: 'El tiempo no espera a nadie', body: 'No podemos recuperar el tiempo perdido, pero si podemos decidir aprovecharlo mejor desde hoy. Llega temprano, haz la diferencia.' },
      { title: 'Puntualidad = Profesionalismo', body: 'En el mundo laboral, la puntualidad es tu carta de presentacion. Dice mas de ti que cualquier curriculum.' },
      { title: 'Hoy es un buen dia para ser puntual', body: 'No importa como fue ayer. Hoy tienes una nueva oportunidad para demostrar tu compromiso. Aprovechala al maximo.' },
      { title: 'Un equipo puntual es un equipo fuerte', body: 'Cuando todos llegamos a tiempo, el trabajo fluye mejor. Se parte de un equipo que se respeta mutuamente.' },
      { title: 'Planifica tu manana desde la noche', body: 'Preparar tu ropa, llaves y ruta la noche anterior te ahorra estres en la manana. Pequenos habitos, grandes resultados.' },
      { title: 'La puntualidad refleja tus valores', body: 'Mas alla de una regla, ser puntual es un valor personal. Demuestra integridad, responsabilidad y respeto por los compromisos.' },
      { title: 'Llega antes, logra mas', body: 'Los primeros minutos del dia son los mas productivos. Aprovecha esa energia llegando a tiempo y organizando tus prioridades.' },
      { title: 'Tu actitud marca la diferencia', body: 'Llegar con buena actitud y a tiempo transforma tu dia laboral. El positivismo y la puntualidad van de la mano.' },
      { title: 'Construye tu legado dia a dia', body: 'Las grandes carreras se construyen con pequenas acciones diarias. La puntualidad es el cimiento de tu crecimiento profesional.' },
      { title: 'El mejor momento es ahora', body: 'No esperes a manana para mejorar tu puntualidad. Hoy es el dia perfecto para empezar un nuevo habito que transforme tu carrera.' },
      { title: 'Juntos somos mas fuertes', body: 'Cuando cada miembro del equipo respeta los horarios, la productividad se multiplica. Tu puntualidad fortalece a todo el equipo.' },
      { title: 'Transforma tu rutina matutina', body: 'Levantarse 15 minutos antes puede cambiar tu dia. Menos prisa, menos estres, mas control. Intentalo esta semana.' },
      { title: 'La constancia vence al talento', body: 'Un profesional constante y puntual siempre supera a uno talentoso pero impredecible. Se constante, se confiable.' },
      { title: 'Tu futuro se decide hoy', body: 'Cada decision de llegar a tiempo es una inversion en tu futuro profesional. Las oportunidades llegan a quienes estan presentes.' },
      { title: 'Celebra tus logros de puntualidad', body: 'Si llevas una buena racha de puntualidad, felicitate. Reconocer tus logros te motiva a mantener el buen habito.' },
      { title: 'La excelencia es un habito', body: 'Como dijo Aristoteles: somos lo que hacemos repetidamente. La excelencia no es un acto, es un habito. Se puntual por habito.' },
      { title: 'Piensa en tu equipo', body: 'Cuando llegas tarde, alguien mas cubre tu ausencia. Piensa en tus companeros y en el impacto positivo de tu puntualidad.' },
      { title: 'Pequenos cambios, grandes resultados', body: 'Salir 10 minutos antes de casa, preparar todo la noche anterior, poner dos alarmas. Pequenos ajustes que transforman tu puntualidad.' },
      { title: 'Se parte del cambio', body: 'Una cultura de puntualidad empieza por cada uno de nosotros. Se el cambio que quieres ver en tu equipo de trabajo.' },
      { title: 'La puntualidad es libertad', body: 'Llegar a tiempo te libera del estres de las excusas y las disculpas. Vive con tranquilidad, llega con tiempo de sobra.' },
      { title: 'Haz que cuente cada dia', body: 'Tienes la oportunidad de empezar bien cada manana. Aprovecha ese regalo siendo puntual y dando lo mejor de ti.' },
      { title: 'Tu reputacion te precede', body: 'Antes de que hables, tu historial de puntualidad ya habla por ti. Construye una reputacion que abra puertas.' },
    ];

    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    return messages[dayOfYear % messages.length];
  }, []);

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
            <div className="flex space-x-2">
              <button
                onClick={handleCleanDuplicates}
                disabled={isCleaningDuplicates}
                className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-slate-100/50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {isCleaningDuplicates ? 'Limpiando...' : 'Limpiar Duplicados'}
              </button>
              <button
                onClick={handleDownloadLogs}
                disabled={filteredLogs.length === 0}
                className="inline-flex items-center px-3 py-1 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white/60 hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:bg-slate-100/50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <DownloadIcon />
                <span className="ml-2">Descargar CSV</span>
              </button>
            </div>
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
          <AdminLogTable
            logs={filteredLogs}
            getEffectiveScheduleTime={getEffectiveScheduleTime}
            onEditLog={canEdit ? handleEditLog : undefined}
            onDeleteLog={canEdit ? handleDeleteLog : undefined}
            toleranceMinutes={toleranceMinutes}
          />
        </div>

        {/* Reportes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Resumen de Horas Trabajadas</h2>
            <WorkedHoursSummary logs={filteredLogs} />
          </div>
          <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Reporte de Incidencias</h2>
            <IncidentsReport logs={filteredLogs} getEffectiveScheduleTime={getEffectiveScheduleTime} toleranceMinutes={toleranceMinutes} />
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
                            <th className="py-3 px-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Supervisor</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Admin</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado Final</th>
                            {(isAdmin || isSupervisor) && (
                              <th className="py-3 px-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {permissionRequests.length > 0 ? [...permissionRequests].reverse().map(req => {
                            const supStatus = req.supervisorApproval?.status || 'pendiente';
                            const admStatus = req.adminApproval?.status || 'pendiente';
                            const isFinal = req.status === 'Aprobado' || req.status?.startsWith('Denegado');

                            // Supervisor puede actuar si su paso esta pendiente
                            const canSupervisorAct = isSupervisor && supStatus === 'pendiente';
                            // Admin puede actuar si: supervisor pendiente (actua como sup) o supervisor aprobo (da aprobacion final)
                            const canAdminAct = isAdmin && !isFinal && !(supStatus === 'aprobado' && admStatus === 'aprobado');

                            return (
                            <tr key={req.id} className="hover:bg-slate-100/50">
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-800">{`${req.firstName} ${req.lastName} ${req.motherLastName}`}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{new Date(req.requestDate + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{req.permissionType}</td>
                                <td className="py-3 px-4 text-sm text-slate-700">{getPermissionDetailsText(req)}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-center">
                                    {req.compensation === Compensation.EXTRA_TIME ? (
                                        <span className="font-mono font-semibold text-amber-800 bg-amber-100/60 px-2 py-1 rounded">
                                            {formatMinutes(calculateMinutesToCompensate(req, findDetailedEmployee(`${req.lastName} ${req.motherLastName} ${req.firstName}`.toUpperCase().replace(/\s+/g, ' ').trim(), detailedEmployees)))}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">-</span>
                                    )}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{req.reason}</td>
                                {/* Columna Supervisor */}
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-center">
                                    {supStatus === 'aprobado' ? (
                                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800" title={req.supervisorApproval?.byName ? `Por: ${req.supervisorApproval.byName}` : ''}>
                                        Aprobado
                                      </span>
                                    ) : supStatus === 'denegado' ? (
                                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800" title={req.supervisorApproval?.byName ? `Por: ${req.supervisorApproval.byName}` : ''}>
                                        Denegado
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                        Pendiente
                                      </span>
                                    )}
                                </td>
                                {/* Columna Admin */}
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-center">
                                    {supStatus !== 'aprobado' ? (
                                      <span className="px-2 py-1 text-xs text-slate-400">Esperando supervisor</span>
                                    ) : admStatus === 'aprobado' ? (
                                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800" title={req.adminApproval?.byName ? `Por: ${req.adminApproval.byName}` : ''}>
                                        Aprobado
                                      </span>
                                    ) : admStatus === 'denegado' ? (
                                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800" title={req.adminApproval?.byName ? `Por: ${req.adminApproval.byName}` : ''}>
                                        Denegado
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                        Pendiente
                                      </span>
                                    )}
                                </td>
                                {/* Estado Final */}
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        req.status === 'Aprobado' ? 'bg-green-100 text-green-800' :
                                        req.status?.startsWith('Denegado') ? 'bg-red-100 text-red-800' :
                                        req.status === 'Aprobado por Supervisor' ? 'bg-blue-100 text-blue-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {req.status}
                                    </span>
                                </td>
                                {/* Acciones */}
                                {(isAdmin || isSupervisor) && (
                                  <td className="py-3 px-4 whitespace-nowrap text-sm text-center">
                                    <div className="flex gap-1 justify-center items-center">
                                      {(canSupervisorAct || canAdminAct) && (
                                        <>
                                          <button
                                            onClick={() => handlePermissionDecision(req.id, 'aprobado')}
                                            className="px-2 py-1 text-xs font-medium rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                                            title="Aprobar"
                                          >
                                            Aprobar
                                          </button>
                                          <button
                                            onClick={() => handlePermissionDecision(req.id, 'denegado')}
                                            className="px-2 py-1 text-xs font-medium rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                                            title="Denegar"
                                          >
                                            Denegar
                                          </button>
                                        </>
                                      )}
                                      {!canSupervisorAct && !canAdminAct && (
                                        <span className="text-xs text-slate-400 mr-1">
                                          {isFinal ? 'Finalizado' : ''}
                                        </span>
                                      )}
                                      {canEdit && (
                                        <>
                                          <button
                                            onClick={() => {
                                              const newStatus = prompt('Cambiar estado a:\n1 = Pendiente\n2 = Aprobado\n3 = Denegado\n\nIngresa 1, 2 o 3:');
                                              if (!newStatus) return;
                                              const statusMap: Record<string, string> = { '1': 'Pendiente', '2': 'Aprobado', '3': 'Denegado por Admin' };
                                              const newVal = statusMap[newStatus];
                                              if (newVal) {
                                                permissionsService.update(req.id, {
                                                  status: newVal,
                                                  ...(newStatus === '2' ? { supervisorApproval: { status: 'aprobado', by: user?.email || '', date: new Date().toISOString() }, adminApproval: { status: 'aprobado', by: user?.email || '', date: new Date().toISOString() } } : {}),
                                                  ...(newStatus === '3' ? { supervisorApproval: { status: 'denegado', by: user?.email || '', date: new Date().toISOString(), comment: 'Editado por admin' }, adminApproval: { status: 'denegado', by: user?.email || '', date: new Date().toISOString() } } : {}),
                                                });
                                                toast.success(`Estado cambiado a "${newVal}".`);
                                              }
                                            }}
                                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                            title="Editar estado"
                                          >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                          </button>
                                          <button
                                            onClick={() => {
                                              if (confirm(`Eliminar solicitud de ${req.firstName} ${req.lastName}?`)) {
                                                permissionsService.delete(req.id);
                                                toast.success('Solicitud eliminada.');
                                              }
                                            }}
                                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Eliminar solicitud"
                                          >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                )}
                            </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={isAdmin || isSupervisor ? 10 : 9} className="text-center py-4 text-sm text-slate-500">No hay solicitudes de permiso registradas.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Horas Pendientes */}
        {Object.keys(calculatedOwedHours).length > 0 && (
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Horas Pendientes por Reponer</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {Object.entries(calculatedOwedHours).map(([empName, remainingHours]) => {
                  const totalOwed = (() => {
                    let total = 0;
                    permissionRequests.forEach(req => {
                      if (req.compensation !== Compensation.EXTRA_TIME || req.adminApproval?.status !== 'aprobado') return;
                      const name = `${req.lastName} ${req.motherLastName} ${req.firstName}`.toUpperCase().replace(/\s+/g, ' ').trim();
                      if (name !== empName) return;
                      const emp = findDetailedEmployee(name, detailedEmployees);
                      total += calculateMinutesToCompensate(req, emp);
                    });
                    return total / 60;
                  })();
                  const compensated = totalOwed - remainingHours;
                  const pct = totalOwed > 0 ? Math.min(100, (compensated / totalOwed) * 100) : 0;

                  return (
                    <div key={empName} className="p-3 bg-slate-50/50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-slate-800">{empName}</p>
                            <span className={`font-mono font-bold text-base px-3 py-0.5 rounded-md ${
                              remainingHours <= 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
                            }`}>
                              {remainingHours.toFixed(1)}h
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-1.5">
                            <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Repuesto: {compensated.toFixed(1)}h de {totalOwed.toFixed(1)}h</span>
                            <span>{pct.toFixed(0)}%</span>
                        </div>
                    </div>
                  );
                })}
            </div>
            <p className="mt-3 text-xs text-slate-400 text-center">
                Calcula automáticamente el tiempo repuesto comparando entradas/salidas reales vs horario del empleado.
            </p>
        </div>
        )}

        {/* Gestion de Vacaciones */}
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
          <button
            onClick={() => setIsVacationSectionVisible(!isVacationSectionVisible)}
            className="w-full flex justify-between items-center text-left"
          >
            <h2 className="text-xl font-bold text-slate-800">
              Solicitudes de Vacaciones
              <span className="ml-2 text-sm font-normal text-slate-500">({vacationRequests.length})</span>
            </h2>
            <ChevronDownIcon className={`transition-transform duration-300 ${isVacationSectionVisible ? 'rotate-180' : ''}`} />
          </button>

          {isVacationSectionVisible && (
            <div className="mt-4 border-t pt-4 border-slate-300/50">
              {vacationRequests.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No hay solicitudes de vacaciones.</p>
              ) : (
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="min-w-full bg-white/60 rounded-lg shadow text-sm">
                    <thead className="bg-white/80 sticky top-0">
                      <tr>
                        <th className="py-3 px-3 text-left text-xs font-semibold text-slate-600 uppercase">Colaborador</th>
                        <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase">Dias</th>
                        <th className="py-3 px-3 text-left text-xs font-semibold text-slate-600 uppercase">Fechas</th>
                        <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase">Estado</th>
                        <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase">Registrado</th>
                        {canEdit && <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {vacationRequests.map(vr => (
                        <tr key={vr.id} className="hover:bg-slate-100/50">
                          <td className="py-3 px-3">
                            <p className="font-medium text-slate-800">{vr.employeeName}</p>
                            <p className="text-xs text-slate-400">Cod: {vr.employeeCode}</p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-amber-800">{vr.daysRequested}</span>
                            <span className="text-xs text-slate-400 ml-1">de {vr.daysEntitled}</span>
                          </td>
                          <td className="py-3 px-3">
                            {editingVacation?.id === vr.id ? (
                              <textarea
                                value={editVacDates}
                                onChange={e => setEditVacDates(e.target.value)}
                                rows={2}
                                className="w-full px-2 py-1 border border-amber-300 rounded text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                                placeholder="YYYY-MM-DD, uno por linea"
                              />
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {vr.dates.slice(0, 5).map(d => (
                                  <span key={d} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-mono">
                                    {new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                                  </span>
                                ))}
                                {vr.dates.length > 5 && <span className="text-[10px] text-slate-400">+{vr.dates.length - 5} mas</span>}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              vr.status === 'aprobada' ? 'bg-green-100 text-green-800' :
                              vr.status === 'rechazada' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>{vr.status}</span>
                          </td>
                          <td className="py-3 px-3 text-center text-xs text-slate-500">
                            {new Date(vr.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </td>
                          {canEdit && (
                            <td className="py-3 px-3 text-center">
                              {editingVacation?.id === vr.id ? (
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={async () => {
                                      const newDates = editVacDates.split('\n').map(d => d.trim()).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
                                      if (newDates.length === 0) { toast.warning('Ingresa fechas validas (YYYY-MM-DD)'); return; }
                                      await vacationRequestsService.update(vr.id!, { dates: newDates, daysRequested: newDates.length });
                                      setEditingVacation(null);
                                      toast.success('Fechas actualizadas.');
                                    }}
                                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                                  >Guardar</button>
                                  <button onClick={() => setEditingVacation(null)} className="px-2 py-1 text-xs bg-slate-300 text-slate-700 rounded hover:bg-slate-400">Cancelar</button>
                                </div>
                              ) : (
                                <div className="flex gap-1 justify-center">
                                  {vr.status === 'pendiente' && (
                                    <>
                                      <button onClick={() => { vacationRequestsService.update(vr.id!, { status: 'aprobada' }); toast.success('Vacacion aprobada.'); }} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Aprobar</button>
                                      <button onClick={() => { vacationRequestsService.update(vr.id!, { status: 'rechazada' }); toast.success('Vacacion rechazada.'); }} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Rechazar</button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => generateVacationPdf(vr)}
                                    className="p-1 text-slate-400 hover:text-blue-600 rounded" title="Descargar PDF"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                  </button>
                                  <button
                                    onClick={() => { setEditingVacation(vr); setEditVacDates(vr.dates.join('\n')); }}
                                    className="p-1 text-slate-400 hover:text-amber-600 rounded" title="Editar fechas"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                  </button>
                                  <button
                                    onClick={async () => { await vacationRequestsService.remove(vr.id!); toast.success('Solicitud eliminada. Dias restablecidos.'); }}
                                    className="p-1 text-slate-400 hover:text-red-600 rounded" title="Eliminar (restablece dias)"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gestion de Retardos */}
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-800">Gestion de Retardos</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-500">Desde:</label>
                <input
                  type="date"
                  value={tardinessStartDate}
                  onChange={(e) => setTardinessStartDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white/80 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-slate-500">Hasta:</label>
                <input
                  type="date"
                  value={tardinessEndDate}
                  onChange={(e) => setTardinessEndDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white/80 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                {tardinessData.length} retardo{tardinessData.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Configuracion de tolerancia */}
          {canEdit && (
            <div className="mb-4 p-3 bg-slate-50/80 rounded-lg border border-slate-200 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-slate-700">Tolerancia actual:</span>
              </div>
              {!editingTolerance ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">{toleranceMinutes} min</span>
                  <button
                    onClick={() => { setEditingTolerance(true); setTempTolerance(toleranceMinutes); }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Modificar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={tempTolerance}
                    onChange={(e) => setTempTolerance(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-sm border border-slate-300 rounded bg-white text-center"
                  />
                  <span className="text-xs text-slate-500">minutos</span>
                  <button
                    onClick={handleSaveTolerance}
                    disabled={savingTolerance}
                    className="px-2 py-1 text-xs font-medium rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditingTolerance(false)}
                    className="px-2 py-1 text-xs font-medium rounded bg-slate-300 text-slate-700 hover:bg-slate-400"
                  >
                    Cancelar
                  </button>
                </div>
              )}
              <span className="text-xs text-slate-400 ml-auto">Despues de este tiempo se marca como retardo</span>
            </div>
          )}

          {/* Mensaje motivacional - solo si hay retardos en ultimos 15 dias */}
          {hasRecentTardiness && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                  </svg>
                  Mensaje Motivacional del Dia
                </h3>
                {canEdit && (
                  <button
                    onClick={handleToggleMotivational}
                    disabled={togglingMotivational}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      motivationalEnabled ? 'bg-green-500' : 'bg-slate-300'
                    }`}
                    title={motivationalEnabled ? 'Desactivar mensajes' : 'Activar mensajes'}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                      motivationalEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                )}
              </div>
              {motivationalEnabled ? (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-900">{dailyMotivationalMessage.title}</p>
                  <p className="text-xs text-amber-800 mt-1">{dailyMotivationalMessage.body}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Mensajes motivacionales desactivados.</p>
              )}
            </div>
          )}

          {/* Tabla de retardos */}
          <div className="overflow-x-auto max-h-[500px]">
            <table className="min-w-full bg-white/60 rounded-lg shadow">
              <thead className="bg-white/80 sticky top-0">
                <tr>
                  <th className="py-3 px-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Colaborador</th>
                  <th className="py-3 px-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</th>
                  <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Hora Entrada</th>
                  <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario</th>
                  <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Min. Retardo</th>
                  <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Min. Ajustados</th>
                  <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Sancion</th>
                  {canEdit && (
                    <th className="py-3 px-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tardinessData.length > 0 ? tardinessData.map(td => {
                  const adj = getAdjustment(td.employeeName, td.date);
                  const editKey = `${td.employeeName}__${td.date}`;
                  const isEditing = editingTardiness?.key === editKey;
                  const effectiveMinutes = adj ? adj.adjustedMinutesLate : td.minutesLate;
                  const hasSanction = adj ? adj.hasSanction : true;
                  const isAuthorized = adj?.isAuthorized === true;

                  return (
                    <tr key={editKey} className={`hover:bg-slate-100/50 ${isAuthorized ? 'bg-blue-50/40' : ''}`}>
                      <td className="py-2 px-3 text-sm text-slate-800 whitespace-nowrap">
                        {td.employeeName}
                        {isAuthorized && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700">Autorizado</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-sm text-slate-700 font-mono whitespace-nowrap">
                        {new Date(td.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="py-2 px-3 text-sm text-center font-mono text-red-700 font-semibold">{td.checkInTime}</td>
                      <td className="py-2 px-3 text-sm text-center font-mono text-slate-600">{td.scheduleTime}</td>
                      <td className="py-2 px-3 text-sm text-center">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded ${isAuthorized ? 'text-blue-600 bg-blue-100/60 line-through' : 'text-amber-800 bg-amber-100/60'}`}>
                          {td.minutesLate} min
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-center">
                        {isEditing ? (
                          editingTardiness.isAuthorized ? (
                            <span className="text-xs font-semibold text-blue-700">0 min (autorizado)</span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              value={editingTardiness.minutes}
                              onChange={(e) => setEditingTardiness(prev => prev ? {...prev, minutes: parseInt(e.target.value) || 0} : null)}
                              className="w-20 text-center px-2 py-1 border border-amber-300 rounded text-sm font-mono"
                            />
                          )
                        ) : (
                          <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                            isAuthorized ? 'text-blue-800 bg-blue-100/60' :
                            effectiveMinutes !== td.minutesLate ? 'text-blue-800 bg-blue-100/60' : 'text-slate-600'
                          }`}>
                            {effectiveMinutes} min
                            {isAuthorized && <span className="text-[10px] ml-1 text-blue-500">autorizado</span>}
                            {!isAuthorized && effectiveMinutes !== td.minutesLate && (
                              <span className="text-[10px] ml-1 text-blue-500">ajustado</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-sm text-center">
                        {isEditing ? (
                          editingTardiness.isAuthorized ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Autorizado</span>
                          ) : (
                            <select
                              value={editingTardiness.sanction ? 'si' : 'no'}
                              onChange={(e) => setEditingTardiness(prev => prev ? {...prev, sanction: e.target.value === 'si'} : null)}
                              className="text-xs px-2 py-1 border border-slate-300 rounded"
                            >
                              <option value="si">Si aplica</option>
                              <option value="no">No aplica</option>
                            </select>
                          )
                        ) : isAuthorized ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Autorizado</span>
                        ) : (
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            hasSanction ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {hasSanction ? 'Si aplica' : 'No aplica'}
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-2 px-3 text-sm text-center">
                          {isEditing ? (
                            <div className="space-y-1">
                              {!editingTardiness.isAuthorized && (
                                <input
                                  type="text"
                                  placeholder="Motivo del ajuste..."
                                  value={editingTardiness.reason}
                                  onChange={(e) => setEditingTardiness(prev => prev ? {...prev, reason: e.target.value} : null)}
                                  className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
                                />
                              )}
                              {editingTardiness.isAuthorized && (
                                <input
                                  type="text"
                                  placeholder="Motivo de autorizacion..."
                                  value={editingTardiness.reason}
                                  onChange={(e) => setEditingTardiness(prev => prev ? {...prev, reason: e.target.value} : null)}
                                  className="w-full text-xs px-2 py-1 border border-blue-300 rounded"
                                />
                              )}
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => handleSaveTardinessAdjustment(td.employeeName, td.date, td.minutesLate)}
                                  className="px-2 py-1 text-xs font-medium rounded bg-green-500 text-white hover:bg-green-600"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => setEditingTardiness(null)}
                                  className="px-2 py-1 text-xs font-medium rounded bg-slate-300 text-slate-700 hover:bg-slate-400"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-center flex-wrap">
                              <button
                                onClick={() => setEditingTardiness({
                                  key: editKey,
                                  minutes: effectiveMinutes,
                                  sanction: hasSanction,
                                  reason: adj?.reason || '',
                                  isAuthorized: false,
                                })}
                                className="px-2 py-1 text-xs font-medium rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                                title="Ajustar retardo"
                              >
                                Ajustar
                              </button>
                              {!isAuthorized ? (
                                <button
                                  onClick={() => setEditingTardiness({
                                    key: editKey,
                                    minutes: 0,
                                    sanction: false,
                                    reason: adj?.reason || 'Entrada autorizada',
                                    isAuthorized: true,
                                  })}
                                  className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                  title="Marcar como entrada autorizada (no cuenta como retardo)"
                                >
                                  Autorizar
                                </button>
                              ) : (
                                <button
                                  onClick={() => setEditingTardiness({
                                    key: editKey,
                                    minutes: td.minutesLate,
                                    sanction: true,
                                    reason: '',
                                    isAuthorized: false,
                                  })}
                                  className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                  title="Quitar autorizacion"
                                >
                                  Revocar
                                </button>
                              )}
                            </div>
                          )}
                          {adj?.reason && !isEditing && (
                            <p className="text-[10px] text-slate-500 mt-1 max-w-[150px] truncate" title={adj.reason}>
                              {adj.reason}
                            </p>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="text-center py-6 text-sm text-slate-500">
                      No hay retardos en el periodo seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Resumen de retardos por colaborador */}
          {tardinessData.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(
                tardinessData.reduce((acc, td) => {
                  const adj = getAdjustment(td.employeeName, td.date);
                  const hasSanction = adj ? adj.hasSanction : true;
                  if (!acc[td.employeeName]) acc[td.employeeName] = { total: 0, withSanction: 0 };
                  acc[td.employeeName].total++;
                  if (hasSanction) acc[td.employeeName].withSanction++;
                  return acc;
                }, {} as Record<string, { total: number; withSanction: number }>)
              ).map(([name, data]) => (
                <div key={name} className="p-2 bg-slate-50/80 rounded-lg border border-slate-200 text-center">
                  <p className="text-xs font-medium text-slate-800 truncate" title={name}>{name.split(' ').slice(0, 2).join(' ')}</p>
                  <p className="text-lg font-bold text-amber-700">{data.total}</p>
                  <p className="text-[10px] text-slate-500">
                    {data.withSanction} con sancion
                    {data.total - data.withSanction > 0 && `, ${data.total - data.withSanction} sin`}
                  </p>
                </div>
              ))}
            </div>
          )}
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
              {canEdit ? (
              <>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Alta de Nuevo Colaborador</h3>
              <form onSubmit={handleRegisterEmployee} className="space-y-4">
                {/* Email para acceso al sistema */}
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
                  <label htmlFor="email" className="block text-sm font-medium text-blue-800">Email (para acceso al sistema)</label>
                  <input type="email" name="email" id="email" value={newEmployee.email} onChange={handleNewEmployeeChange} required placeholder="colaborador@empresa.com" className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
                  <p className="mt-1 text-xs text-blue-600">La contraseña será el código de 6 dígitos generado automáticamente (fecha de nacimiento: DDMMAA)</p>
                </div>

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
                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="mt-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRegistering ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Registrando...
                      </>
                    ) : (
                      'Registrar Colaborador'
                    )}
                  </button>
                </div>
              </form>
              </>
              ) : (
                <p className="text-sm text-slate-500 italic mb-4">Modo supervisor: solo lectura.</p>
              )}

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
                                {canEdit && <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>}
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Código</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Nombre Completo</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Puesto</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Departamento</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario L,M,M,V</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario Jueves</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario Sáb</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha Ingreso</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Antigüedad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {detailedEmployees.length > 0 ? detailedEmployees.map(emp => (
                                <tr key={emp.id} className={`hover:bg-slate-100/50 ${emp.activo === false ? 'bg-red-50/60 opacity-60' : ''}`}>
                                    {canEdit && <td className="py-3 px-4 whitespace-nowrap text-sm">
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleEditEmployee(emp)}
                                                className="text-blue-600 hover:text-blue-800 font-medium"
                                                title="Editar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteEmployee(emp)}
                                                className="text-red-600 hover:text-red-800 font-medium"
                                                title="Dar de baja"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                            {/* Botón crear cuenta - solo si no tiene firebaseUid */}
                                            {!emp.firebaseUid && (
                                                <button
                                                    onClick={() => handleCreateAccount(emp)}
                                                    disabled={creatingAccountForId === emp.id}
                                                    className={`font-medium ${
                                                        emp.email
                                                            ? 'text-green-600 hover:text-green-800'
                                                            : 'text-slate-400 cursor-not-allowed'
                                                    }`}
                                                    title={emp.email ? 'Crear cuenta de acceso' : 'Agrega un email primero'}
                                                >
                                                    {creatingAccountForId === emp.id ? (
                                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                            {/* Indicador de cuenta activa y botón restablecer contraseña */}
                                            {emp.firebaseUid && (
                                                <>
                                                    <span className="text-green-500" title="Cuenta activa">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                        </svg>
                                                    </span>
                                                    <button
                                                        onClick={() => handleResetPassword(emp)}
                                                        disabled={resettingPasswordForId === emp.id}
                                                        className="text-amber-600 hover:text-amber-800 font-medium"
                                                        title="Restablecer contraseña"
                                                    >
                                                        {resettingPasswordForId === emp.id ? (
                                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                            <span className="border-l border-slate-300 pl-2 ml-1">
                                            <button
                                                onClick={() => handleToggleActive(emp)}
                                                disabled={togglingActiveForId === emp.id}
                                                className={`px-2 py-1 rounded text-xs font-bold ${emp.activo === false ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                                                title={emp.activo === false ? 'Reactivar colaborador' : 'Dar de baja por renuncia'}
                                            >
                                                {togglingActiveForId === emp.id ? '...' : emp.activo === false ? 'Reactivar' : 'Baja'}
                                            </button>
                                            </span>
                                        </div>
                                    </td>}
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{emp.codigo}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">
                                        {emp.email ? (
                                            <span className="text-blue-600">{emp.email}</span>
                                        ) : (
                                            <span className="text-slate-400 italic">Sin email</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-800">
                                        <div className="flex items-center gap-2">
                                            {`${emp.nombres} ${emp.paterno} ${emp.materno}`}
                                            {emp.activo === false && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                                                    BAJA {emp.fechaBaja ? `(${emp.fechaBaja})` : ''}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.puesto}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.departamento}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.horarioLunesMiercolesViernes}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.horarioJueves}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{emp.horarioSabado}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{emp.fechaIngreso}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700">{calculateTenure(emp.fechaIngreso)}</td>
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

      {/* Modal de Edición */}
      {isEditModalOpen && editingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Editar Colaborador</h3>
                <button
                  onClick={() => { setIsEditModalOpen(false); setEditingEmployee(null); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Email */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="block text-sm font-medium text-blue-800 mb-1">Email (para acceso al sistema)</label>
                <input
                  type="email"
                  name="email"
                  value={editingEmployee.email || ''}
                  onChange={handleEditFormChange}
                  placeholder="colaborador@empresa.com"
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm"
                />
                {!editingEmployee.firebaseUid && editingEmployee.email && (
                  <p className="mt-1 text-xs text-amber-600">
                    Nota: Este colaborador no tiene cuenta de acceso. Para crearla, deberás registrarlo nuevamente.
                  </p>
                )}
              </div>

              {/* Datos personales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nombre(s)</label>
                  <input type="text" name="nombres" value={editingEmployee.nombres} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Apellido Paterno</label>
                  <input type="text" name="paterno" value={editingEmployee.paterno} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Apellido Materno</label>
                  <input type="text" name="materno" value={editingEmployee.materno} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fecha de Ingreso</label>
                  <input type="date" name="fechaIngreso" value={editingEmployee.fechaIngreso} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Fecha de Cumpleaños</label>
                  <input type="date" name="fechaNacimiento" value={editingEmployee.fechaNacimiento} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Documentos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">CURP</label>
                  <input type="text" name="curp" value={editingEmployee.curp} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">RFC</label>
                  <input type="text" name="rfc" value={editingEmployee.rfc} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">NSS</label>
                  <input type="text" name="nss" value={editingEmployee.nss} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Puesto y Departamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Departamento</label>
                  <input type="text" name="departamento" value={editingEmployee.departamento} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Puesto</label>
                  <input type="text" name="puesto" value={editingEmployee.puesto} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Bonos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Bono Puntualidad ($)</label>
                  <input type="number" step="0.01" min="0" name="bonoPuntualidad" value={editingEmployee.bonoPuntualidad} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Bono Objetivos ($)</label>
                  <input type="number" step="0.01" min="0" name="bonoObjetivos" value={editingEmployee.bonoObjetivos} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Apoyo Gasolina ($)</label>
                  <input type="number" step="0.01" min="0" name="apoyoGasolina" value={editingEmployee.apoyoGasolina} onChange={handleEditFormChange} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"/>
                </div>
              </div>

              {/* Gestión de Contraseña */}
              {editingEmployee.firebaseUid && editingEmployee.email && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <label className="block text-sm font-medium text-amber-800 mb-2">Gestión de Contraseña</label>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      {editingEmployee.lastPasswordReset ? (
                        <p>Último restablecimiento: <strong>{new Date(editingEmployee.lastPasswordReset).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></p>
                      ) : (
                        <p className="text-slate-400">Sin restablecimientos registrados</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetPassword(editingEmployee)}
                      disabled={resettingPasswordForId === editingEmployee.id}
                      className="ml-3 px-3 py-1.5 text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-md disabled:opacity-50 flex items-center gap-1"
                    >
                      {resettingPasswordForId === editingEmployee.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Enviando...
                        </>
                      ) : (
                        'Enviar email de restablecimiento'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Info adicional */}
              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <p><strong>Código:</strong> {editingEmployee.codigo}</p>
                {editingEmployee.firebaseUid && (
                  <p className="text-green-600 mt-1">Este colaborador tiene cuenta de acceso activa.</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => { setIsEditModalOpen(false); setEditingEmployee(null); }}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 text-white bg-gradient-to-r from-amber-600 to-orange-600 rounded-md hover:from-amber-700 hover:to-orange-700 disabled:opacity-50"
              >
                {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición de Log de Asistencia */}
      {isLogEditModalOpen && editingLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Editar Registro de Asistencia</h3>
                <button
                  onClick={() => { setIsLogEditModalOpen(false); setEditingLog(null); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Colaborador (solo lectura) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Colaborador</label>
                <input
                  type="text"
                  value={editingLog.employeeName}
                  readOnly
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-slate-600"
                />
              </div>

              {/* Tipo de registro */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Registro</label>
                <select
                  value={editingLog.type}
                  onChange={(e) => setEditingLog({ ...editingLog, type: e.target.value as LogType })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                >
                  <option value={LogType.ENTRADA}>ENTRADA</option>
                  <option value={LogType.SALIDA}>SALIDA</option>
                  <option value={LogType.INICIO_COMIDA}>INICIO COMIDA</option>
                  <option value={LogType.FIN_COMIDA}>FIN COMIDA</option>
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={editLogDate}
                  onChange={(e) => setEditLogDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                />
              </div>

              {/* Hora */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                <input
                  type="time"
                  value={editLogTime}
                  onChange={(e) => setEditLogTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                />
              </div>

              {/* Ubicación (solo lectura si existe) */}
              {editingLog.location && (
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                  <p><strong>Ubicación registrada:</strong></p>
                  <p className="font-mono text-xs mt-1">
                    {editingLog.location.lat.toFixed(6)}, {editingLog.location.lon.toFixed(6)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${editingLog.location.lat},${editingLog.location.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 hover:underline text-xs"
                  >
                    Ver en mapa
                  </a>
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <p><strong>Nota:</strong> Esta función es para corregir errores en los registros. Use con responsabilidad.</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => { setIsLogEditModalOpen(false); setEditingLog(null); }}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLogEdit}
                disabled={isSavingLog}
                className="px-4 py-2 text-white bg-gradient-to-r from-amber-600 to-orange-600 rounded-md hover:from-amber-700 hover:to-orange-700 disabled:opacity-50"
              >
                {isSavingLog ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};