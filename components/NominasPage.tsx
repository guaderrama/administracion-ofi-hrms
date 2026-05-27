import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { employeesService, logsService, attendanceDaysService, payrollCutsService, commissionsService, vacationRequestsService, permissionsService, type PayrollCut, type SavedCommissionReport, type VacationRequestRecord } from '../src/services/firestoreService';
import type { PermissionRequest } from '../types';
import { Compensation } from '../types';
import { useToast } from './ui/Toast';
import { NominasPdfPreview, type CommissionBreakdown } from './NominasPdfPreview';
import {
  PayrollPeriod,
  getCurrentPeriod,
  getPeriodLabel,
  calculateSalary,
  calculateVacation,
  formatCurrency,
  formatDateShort,
  getEmployeeFullName,
  getDaysInQuincena,
  getDefaultPeriod,
} from './nominasUtils';
import type { DetailedEmployee, LogEntry } from '../types';
import { LogType } from '../types';
import { AccessDenied } from './ui/AccessDenied';
import { StatusBadge } from './ui/StatusBadge';
import { Card } from './ui/Card';

declare const jspdf: any;
declare const html2canvas: any;

interface NominasPageProps {
  setView: (view: string) => void;
}

export const NominasPage: React.FC<NominasPageProps> = ({ setView }) => {
  const { isAdmin, canViewAll, canEdit, user } = useAuth();
  const toast = useToast();
  const [employees, setEmployees] = useState<DetailedEmployee[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod>(getCurrentPeriod());
  const [selectedEmployee, setSelectedEmployee] = useState<DetailedEmployee | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 });
  const [daysWorked, setDaysWorked] = useState<Record<string, number>>({});
  const [originalDays, setOriginalDays] = useState<Record<string, number>>({}); // días calculados por asistencia
  const [employeeNotes, setEmployeeNotes] = useState<Record<string, string>>({});
  const [savedCuts, setSavedCuts] = useState<PayrollCut[]>([]);
  const [savingCut, setSavingCut] = useState(false);
  const [showSavedCuts, setShowSavedCuts] = useState(false);

  // Comisiones
  const [commissionReports, setCommissionReports] = useState<SavedCommissionReport[]>([]);
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<Set<string>>(new Set());
  const draftDaysRef = useRef<Record<string, number> | null>(null); // Saved daysWorked from loaded draft

  useEffect(() => {
    const unsubscribe = employeesService.subscribe((emps) => setEmployees(emps));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = payrollCutsService.subscribe((cuts) => setSavedCuts(cuts));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = commissionsService.subscribe((reports) => setCommissionReports(reports));
    return () => unsubscribe();
  }, []);

  // Vacaciones y permisos aprobados
  const [approvedVacations, setApprovedVacations] = useState<VacationRequestRecord[]>([]);
  const [approvedPermissions, setApprovedPermissions] = useState<PermissionRequest[]>([]);

  useEffect(() => {
    const unsub1 = vacationRequestsService.subscribe((reqs) => {
      setApprovedVacations(reqs.filter(r => r.status === 'aprobada'));
    });
    const unsub2 = permissionsService.subscribe((reqs) => {
      setApprovedPermissions(reqs.filter(r =>
        r.adminApproval?.status === 'aprobado' &&
        (r.compensation === Compensation.WITH_PAY || r.compensation === Compensation.VACATION)
      ));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Días pagados por vacaciones/permisos por empleado en el periodo
  const paidLeaveDays = useMemo((): Record<string, Set<string>> => {
    const result: Record<string, Set<string>> = {};
    employees.forEach(emp => { result[emp.id] = new Set(); });

    const periodStart = selectedPeriod.startDate;
    const periodEnd = selectedPeriod.endDate;

    // Vacaciones aprobadas
    approvedVacations.forEach(vac => {
      const emp = employees.find(e => e.id === vac.employeeId || e.codigo === vac.employeeCode);
      if (!emp) return;
      (vac.dates || []).forEach(dateStr => {
        if (dateStr >= periodStart && dateStr <= periodEnd) {
          const d = new Date(dateStr + 'T12:00:00');
          result[emp.id]?.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
      });
    });

    // Permisos aprobados con goce o a cuenta de vacaciones
    approvedPermissions.forEach(perm => {
      const empFullName = `${perm.lastName} ${perm.motherLastName} ${perm.firstName}`.toUpperCase().trim();
      const emp = employees.find(e => {
        const eName = `${e.paterno} ${e.materno} ${e.nombres}`.toUpperCase().trim();
        return eName === empFullName || (empFullName.includes(e.paterno.toUpperCase()) && empFullName.includes(e.nombres.toUpperCase()));
      });
      if (!emp) return;

      if (perm.permissionType === 'Días completos' && perm.dates) {
        perm.dates.forEach(dateStr => {
          if (dateStr >= periodStart && dateStr <= periodEnd) {
            const d = new Date(dateStr + 'T12:00:00');
            result[emp.id]?.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
          }
        });
      } else if (perm.permissionDate) {
        if (perm.permissionDate >= periodStart && perm.permissionDate <= periodEnd) {
          const d = new Date(perm.permissionDate + 'T12:00:00');
          result[emp.id]?.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
      }
    });

    return result;
  }, [employees, approvedVacations, approvedPermissions, selectedPeriod]);

  // Reportes de comisiones disponibles (no bloqueados por otro corte)
  const availableCommissions = useMemo(() => {
    return commissionReports.filter(r => !r.lockedByPayroll && r.sales?.length > 0);
  }, [commissionReports]);

  // Comisiones por empleado de los reportes seleccionados
  // Desglose de comisiones por empleado: { code: { total, caminata, semana, originales } }
  const employeeCommissionBreakdown = useMemo((): Record<string, { total: number; caminata: number; semana: number; originales: number }> => {
    const result: Record<string, { total: number; caminata: number; semana: number; originales: number }> = {};
    selectedCommissionIds.forEach(reportId => {
      const report = commissionReports.find(r => r.id === reportId) as any;
      if (!report?.employeeCommissions) return;

      Object.entries(report.employeeCommissions).forEach(([code, amount]) => {
        if (!result[code]) result[code] = { total: 0, caminata: 0, semana: 0, originales: 0 };
        result[code].total += amount as number;

        // Usar desglose guardado si existe, sino inferir del nombre
        const breakdown = report.employeeCommissionBreakdown?.[code];
        if (breakdown) {
          result[code].caminata += breakdown.caminata || 0;
          result[code].semana += breakdown.semana || 0;
          result[code].originales += breakdown.originales || 0;
        } else {
          const isCaminata = (report.name || '').toLowerCase().includes('caminata');
          if (isCaminata) result[code].caminata += amount as number;
          else result[code].semana += amount as number;
        }
      });
    });
    return result;
  }, [selectedCommissionIds, commissionReports]);

  // Labels de las comisiones (nombres de todos los reportes por tipo)
  const commissionLabels = useMemo((): { caminata?: string; semana?: string } => {
    const caminataNames: string[] = [];
    const semanaNames: string[] = [];
    selectedCommissionIds.forEach(reportId => {
      const report = commissionReports.find(r => r.id === reportId);
      if (!report) return;
      // Detectar por desglose guardado, no solo por nombre
      const hasJueves = (report as any).employeeCommissionBreakdown &&
        Object.values((report as any).employeeCommissionBreakdown).some((b: any) => b.caminata > 0);
      const hasSemana = (report as any).employeeCommissionBreakdown &&
        Object.values((report as any).employeeCommissionBreakdown).some((b: any) => b.semana > 0);
      const isCaminata = hasJueves || (report.name || '').toLowerCase().includes('caminata');
      const isSemana = hasSemana || !isCaminata;
      if (isCaminata) caminataNames.push(report.name);
      if (isSemana) semanaNames.push(report.name);
    });
    return {
      caminata: caminataNames.length > 0 ? caminataNames.join(' + ') : undefined,
      semana: semanaNames.length > 0 ? semanaNames.join(' + ') : undefined,
    };
  }, [selectedCommissionIds, commissionReports]);

  // Versión simple para compatibilidad (solo totales)
  const employeeCommissions = useMemo((): Record<string, number> => {
    const totals: Record<string, number> = {};
    Object.entries(employeeCommissionBreakdown).forEach(([code, bd]) => {
      totals[code] = bd.total;
    });
    return totals;
  }, [employeeCommissionBreakdown]);

  const toggleCommissionReport = (reportId: string) => {
    setSelectedCommissionIds(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  const diasEnPeriodo = getDaysInQuincena(selectedPeriod);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  // Calcular días trabajados desde registros de asistencia
  useEffect(() => {
    if (employees.length === 0) return;

    const fetchAttendance = async () => {
      setLoadingAttendance(true);
      try {
        // Cargar ambas fuentes: AttendanceDay (validada) y logs crudos (fallback)
        const attendanceDays = await attendanceDaysService.getByDateRange(
          selectedPeriod.startDate,
          selectedPeriod.endDate
        );

        const startDate = new Date(selectedPeriod.startDate + 'T00:00:00');
        const endDate = new Date(selectedPeriod.endDate + 'T23:59:59');
        const logs = await logsService.getByDateRange(startDate, endDate);

        // Calcular días de descanso en el periodo
        const sundaysInPeriod: string[] = [];
        const saturdaysInPeriod: string[] = [];
        const cursor = new Date(selectedPeriod.startDate + 'T00:00:00');
        const endLimit = new Date(selectedPeriod.endDate + 'T00:00:00');
        while (cursor <= endLimit) {
          const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
          if (cursor.getDay() === 0) sundaysInPeriod.push(key);
          if (cursor.getDay() === 6) saturdaysInPeriod.push(key);
          cursor.setDate(cursor.getDate() + 1);
        }

        const updated: Record<string, number> = {};

        // Fallback POR DÍA POR EMPLEADO: para cada día del periodo,
        // usar AttendanceDay si existe, si no calcular desde logs crudos
        employees.forEach((emp) => {
          const empFullName = `${emp.paterno} ${emp.materno} ${emp.nombres}`.toUpperCase().trim();

          // AttendanceDays de este empleado indexados por fecha
          const empDays = attendanceDays.filter(day =>
            day.employeeCode === emp.codigo ||
            day.employeeName.toUpperCase().trim() === empFullName
          );
          const daysByDate = new Map(empDays.map(d => [d.date, d]));

          // Logs crudos de este empleado agrupados por día
          const empLogs = logs.filter((log: LogEntry) => {
            if (log.employeeCode && emp.codigo && log.employeeCode === emp.codigo) return true;
            const logName = log.employeeName.toUpperCase().trim();
            return logName === empFullName ||
              (logName.includes(emp.paterno.toUpperCase()) &&
               logName.includes(emp.nombres.toUpperCase()));
          });
          const logsByDay: Record<string, LogEntry[]> = {};
          empLogs.forEach((log: LogEntry) => {
            const d = new Date(log.timestamp);
            const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!logsByDay[dayKey]) logsByDay[dayKey] = [];
            logsByDay[dayKey].push(log);
          });

          // Recorrer cada día del periodo
          const workedDays = new Set<string>();
          const dayCursor = new Date(selectedPeriod.startDate + 'T12:00:00');
          const dayEnd = new Date(selectedPeriod.endDate + 'T12:00:00');
          while (dayCursor <= dayEnd) {
            const dateStr = `${dayCursor.getFullYear()}-${String(dayCursor.getMonth() + 1).padStart(2, '0')}-${String(dayCursor.getDate()).padStart(2, '0')}`;
            const dayOfWeek = dayCursor.getDay();
            const dayKeyUnpadded = `${dayCursor.getFullYear()}-${dayCursor.getMonth()}-${dayCursor.getDate()}`;

            if (dayOfWeek === 0) {
              // Domingo: siempre pagado como descanso
              workedDays.add(dayKeyUnpadded);
            } else if (dayOfWeek === 6 && emp.horarioSabado?.toLowerCase().includes('no labora')) {
              // Sábado no laborable: pagado como descanso
              workedDays.add(dayKeyUnpadded);
            } else {
              // Día laborable: contar como trabajado si tiene al menos ENTRADA
              // (registros incompletos se alertan al empleado, pero no descuentan día)
              const attendanceDay = daysByDate.get(dateStr);
              if (attendanceDay) {
                // Tiene AttendanceDay → pagar si tiene al menos entrada
                if (attendanceDay.checkInTimestamp) {
                  workedDays.add(dayKeyUnpadded);
                }
              } else if (logsByDay[dateStr]) {
                // Sin AttendanceDay → verificar si tiene al menos ENTRADA
                const dayLogs = logsByDay[dateStr];
                const hasEntrada = dayLogs.some(l => l.type === LogType.ENTRADA);
                if (hasEntrada) {
                  workedDays.add(dayKeyUnpadded);
                }
              }
              // Vacaciones o permisos aprobados con goce → contar como trabajado
              if (!workedDays.has(dayKeyUnpadded) && paidLeaveDays[emp.id]?.has(dayKeyUnpadded)) {
                workedDays.add(dayKeyUnpadded);
              }
            }

            dayCursor.setDate(dayCursor.getDate() + 1);
          }

          updated[emp.id] = Math.min(workedDays.size, diasEnPeriodo);
        });

        setOriginalDays(updated);
        // If a draft was loaded, use its saved daysWorked instead of recalculated
        if (draftDaysRef.current) {
          setDaysWorked(draftDaysRef.current);
          draftDaysRef.current = null;
        } else {
          setDaysWorked(updated);
        }
        setAttendanceError(null);
      } catch (error) {
        console.error('Error cargando asistencia:', error);
        if (draftDaysRef.current) {
          setDaysWorked(draftDaysRef.current);
          draftDaysRef.current = null;
        } else {
          const fallback: Record<string, number> = {};
          employees.forEach((emp) => { fallback[emp.id] = 0; });
          setDaysWorked(fallback);
          setAttendanceError('Error al cargar asistencia. Los días trabajados se muestran como 0. Recarga la página.');
        }
      } finally {
        setLoadingAttendance(false);
      }
    };

    fetchAttendance();
  }, [employees, selectedPeriod.startDate, selectedPeriod.endDate, diasEnPeriodo]);

  if (!user) {
    return <AccessDenied icon="🔒" title="Acceso Restringido" message="Debes iniciar sesión para acceder a esta sección." onBack={() => setView('dashboard')} />;
  }

  if (!canViewAll) {
    return <AccessDenied message="No tienes permisos para acceder a Nominas." onBack={() => setView('dashboard')} />;
  }

  const generatePdf = async (employee: DetailedEmployee) => {
    await new Promise(resolve => setTimeout(resolve, 200));

    const content = document.getElementById('pdf-content-nomina');
    if (!content) {
      console.error('PDF content element not found');
      return;
    }

    const canvas = await html2canvas(content, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    const periodStr = `${selectedPeriod.startDate}_${selectedPeriod.endDate}_Q${selectedPeriod.quincena}`;
    const fileName = `nomina_${employee.paterno}_${employee.materno}_${employee.nombres}_${periodStr}.pdf`.replace(/\s/g, '_');
    pdf.save(fileName);
  };

  const handlePreview = (employee: DetailedEmployee) => {
    setSelectedEmployee(employee);
  };

  const handleDownloadPdf = async () => {
    if (!selectedEmployee) return;
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      await generatePdf(selectedEmployee);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    try {
      const hasComm = selectedCommissionIds.size > 0;
      const pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const pageW = pdf.internal.pageSize.getWidth();
      let y = 15;

      // Título
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('IVAN GUADERRAMA ART', pageW / 2, y, { align: 'center' });
      y += 6;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Reporte de Nómina — ${getPeriodLabel(selectedPeriod)}`, pageW / 2, y, { align: 'center' });
      y += 8;

      // Headers
      const cols = ['Código', 'Nombre', 'Ingreso', 'Días', 'B.Punt.', 'B.Obj.', 'Ap.Gas.',
        ...(hasComm ? ['Com.Cam.', 'Com.Sem.'] : []), 'Total'];
      const colW = hasComm ? [18, 52, 22, 12, 20, 20, 20, 20, 20, 22] : [20, 60, 25, 14, 24, 24, 24, 26];
      const startX = 8;

      pdf.setFillColor(245, 158, 11);
      pdf.rect(startX, y - 4, pageW - 16, 6, 'F');
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      let x = startX + 2;
      cols.forEach((col, i) => {
        pdf.text(col, x, y, { align: 'left' });
        x += colW[i];
      });
      y += 4;
      pdf.setTextColor(0, 0, 0);

      // Filas
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      employees.forEach(emp => {
        const days = daysWorked[emp.id] ?? diasEnPeriodo;
        const salary = calculateSalary(emp, days, diasEnPeriodo);
        const bd = employeeCommissionBreakdown[emp.codigo];
        const total = salary.netoAPagar + (employeeCommissions[emp.codigo] || 0);
        const row = [
          emp.codigo,
          getEmployeeFullName(emp),
          formatDateShort(emp.fechaIngreso),
          `${days}/${diasEnPeriodo}`,
          `$${salary.bonoPuntualidad.toFixed(2)}`,
          `$${salary.bonoObjetivos.toFixed(2)}`,
          `$${salary.apoyoGasolina.toFixed(2)}`,
          ...(hasComm ? [`$${(bd?.caminata || 0).toFixed(2)}`, `$${(bd?.semana || 0).toFixed(2)}`] : []),
          `$${total.toFixed(2)}`,
        ];

        if (y > 190) { pdf.addPage(); y = 15; }

        x = startX + 2;
        row.forEach((cell, i) => {
          pdf.text(String(cell), x, y);
          x += colW[i];
        });
        y += 5;
      });

      // Totales
      y += 2;
      pdf.setDrawColor(150, 150, 150);
      pdf.line(startX, y - 3, pageW - 8, y - 3);
      pdf.setFont('helvetica', 'bold');
      const commTotal = Object.values(employeeCommissions).reduce((a, b) => a + b, 0);
      const totalRow = [
        '', 'TOTALES', '', '',
        `$${totals.bonoPuntualidad.toFixed(2)}`,
        `$${totals.bonoObjetivos.toFixed(2)}`,
        `$${totals.apoyoGasolina.toFixed(2)}`,
        ...(hasComm ? [
          `$${Object.values(employeeCommissionBreakdown).reduce((a, b) => a + b.caminata, 0).toFixed(2)}`,
          `$${Object.values(employeeCommissionBreakdown).reduce((a, b) => a + b.semana, 0).toFixed(2)}`,
        ] : []),
        `$${(totals.total + commTotal).toFixed(2)}`,
      ];
      x = startX + 2;
      totalRow.forEach((cell, i) => {
        pdf.text(String(cell), x, y);
        x += colW[i];
      });

      pdf.save(`reporte_nomina_${selectedPeriod.startDate}_${selectedPeriod.endDate}.pdf`);
      toast.success('Reporte PDF descargado.');
    } catch (err: any) {
      console.error('Error generando reporte:', err);
      toast.error(`Error: ${err?.message || 'desconocido'}`);
    }
  };

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    setGeneratingProgress({ current: 0, total: employees.length });
    try {
      for (let i = 0; i < employees.length; i++) {
        setSelectedEmployee(employees[i]);
        setGeneratingProgress({ current: i + 1, total: employees.length });
        await new Promise(resolve => setTimeout(resolve, 400));
        await generatePdf(employees[i]);
      }
    } catch (error) {
      console.error('Error generating PDFs:', error);
    } finally {
      setIsGenerating(false);
      setSelectedEmployee(null);
      setGeneratingProgress({ current: 0, total: 0 });
    }
  };

  // Guardar corte de nomina
  const [currentCutId, setCurrentCutId] = useState<string | null>(null);

  const buildCutData = () => {
    const cutEmployees = employees.map(emp => {
      const days = daysWorked[emp.id] ?? diasEnPeriodo;
      const salary = calculateSalary(emp, days, diasEnPeriodo);
      const vacation = calculateVacation(emp.fechaIngreso);
      return {
        codigo: emp.codigo || '',
        nombre: getEmployeeFullName(emp),
        fechaIngreso: emp.fechaIngreso,
        diasVacaciones: vacation.daysEntitled,
        aplicaVacaciones: vacation.eligible,
        diasTrabajados: days,
        diasPeriodo: diasEnPeriodo,
        bonoPuntualidad: salary.bonoPuntualidad,
        bonoObjetivos: salary.bonoObjetivos,
        apoyoGasolina: salary.apoyoGasolina,
        comision: employeeCommissions[emp.codigo] || 0,
        total: salary.netoAPagar + (employeeCommissions[emp.codigo] || 0),
        corregido: days !== (originalDays[emp.id] ?? diasEnPeriodo),
        nota: employeeNotes[emp.id] || '',
      };
    });
    const cutTotals = cutEmployees.reduce(
      (acc, e) => ({
        bonoPuntualidad: acc.bonoPuntualidad + e.bonoPuntualidad,
        bonoObjetivos: acc.bonoObjetivos + e.bonoObjetivos,
        apoyoGasolina: acc.apoyoGasolina + e.apoyoGasolina,
        total: acc.total + e.total,
      }),
      { bonoPuntualidad: 0, bonoObjetivos: 0, apoyoGasolina: 0, total: 0 }
    );
    // Limpiar datos para Firestore (no acepta undefined ni NaN)
    const cleanDaysWorked: Record<string, number> = {};
    Object.entries(daysWorked).forEach(([k, v]) => { if (typeof v === 'number' && !isNaN(v)) cleanDaysWorked[k] = v; });
    const cleanNotes: Record<string, string> = {};
    Object.entries(employeeNotes).forEach(([k, v]) => { if (v) cleanNotes[k] = v; });

    return { cutEmployees, cutTotals, cleanDaysWorked, cleanNotes };
  };

  // Guardar borrador (se puede seguir editando)
  const handleSaveDraft = async () => {
    if (employees.length === 0) return;
    setSavingCut(true);
    try {
      const { cutEmployees, cutTotals, cleanDaysWorked, cleanNotes } = buildCutData();
      const baseCutData = {
        startDate: selectedPeriod.startDate,
        endDate: selectedPeriod.endDate,
        quincena: selectedPeriod.quincena,
        periodLabel: getPeriodLabel(selectedPeriod),
        employees: cutEmployees,
        totals: cutTotals,
        createdBy: user?.email || '',
        status: 'borrador',
        commissionReportIds: Array.from(selectedCommissionIds),
        daysWorked: cleanDaysWorked,
        employeeNotes: cleanNotes,
      };
      if (currentCutId) {
        await payrollCutsService.update(currentCutId, baseCutData as any);
        toast.success('Borrador actualizado.');
      } else {
        const id = await payrollCutsService.create({ ...baseCutData, createdAt: new Date() } as any);
        setCurrentCutId(id);
        toast.success('Borrador guardado.');
      }
    } catch (err: any) {
      console.error('Error guardando borrador:', err);
      toast.error(`Error: ${err?.message || err?.code || 'desconocido'}`);
    } finally {
      setSavingCut(false);
    }
  };

  // Cerrar periodo (bloquea comisiones, ya no se puede editar)
  const handleClosePeriod = async () => {
    if (employees.length === 0) return;
    if (!confirm('¿Cerrar este periodo de nómina? Las comisiones incluidas quedarán bloqueadas y no se podrán modificar.')) return;
    setSavingCut(true);
    try {
      const { cutEmployees, cutTotals, cleanDaysWorked, cleanNotes } = buildCutData();
      const cutData = {
        startDate: selectedPeriod.startDate,
        endDate: selectedPeriod.endDate,
        quincena: selectedPeriod.quincena,
        periodLabel: getPeriodLabel(selectedPeriod),
        employees: cutEmployees,
        totals: cutTotals,
        createdBy: user?.email || '',
        createdAt: new Date(),
        status: 'cerrado' as const,
        commissionReportIds: Array.from(selectedCommissionIds),
        daysWorked: cleanDaysWorked,
        employeeNotes: cleanNotes,
      } as any;
      if (currentCutId) {
        await payrollCutsService.update(currentCutId, cutData);
      } else {
        await payrollCutsService.create(cutData);
      }
      // Bloquear comisiones seleccionadas con candado
      const periodLabel = getPeriodLabel(selectedPeriod);
      for (const reportId of selectedCommissionIds) {
        try {
          await commissionsService.update(reportId, { lockedByPayroll: periodLabel });
        } catch (err) {
          console.error('Error bloqueando comisión:', err);
        }
      }
      setSelectedCommissionIds(new Set());
      setCurrentCutId(null);
      toast.success('Periodo cerrado exitosamente.');
    } catch (err) {
      console.error('Error cerrando periodo:', err);
      toast.error('Error al cerrar periodo.');
    } finally {
      setSavingCut(false);
    }
  };

  // Cargar borrador guardado
  const handleLoadDraft = (cut: PayrollCut) => {
    setCurrentCutId(cut.id || null);
    if (cut.daysWorked) draftDaysRef.current = cut.daysWorked;
    setSelectedPeriod({ startDate: cut.startDate, endDate: cut.endDate, quincena: cut.quincena as 1 | 2 });
    if (cut.daysWorked) setDaysWorked(cut.daysWorked);
    if (cut.commissionReportIds) setSelectedCommissionIds(new Set(cut.commissionReportIds));
    if ((cut as any).employeeNotes) setEmployeeNotes((cut as any).employeeNotes);
    toast.success(`Corte "${cut.periodLabel}" cargado.`);
  };

  // Descargar corte como Excel CSV
  const handleDownloadExcel = (cut: PayrollCut) => {
    const headers = ['Codigo', 'Nombre Completo', 'Fecha Ingreso', 'Dias Vacaciones', 'Aplica Vacaciones', 'Dias Trabajados', 'Dias Periodo', 'Bono Puntualidad', 'Bono Objetivos', 'Apoyo Gasolina', 'Total'];
    const rows = cut.employees.map(e => [
      e.codigo,
      `"${e.nombre}"`,
      e.fechaIngreso,
      e.diasVacaciones,
      e.aplicaVacaciones ? 'Si' : 'No',
      e.diasTrabajados,
      e.diasPeriodo,
      e.bonoPuntualidad.toFixed(2),
      e.bonoObjetivos.toFixed(2),
      e.apoyoGasolina.toFixed(2),
      e.total.toFixed(2),
    ]);
    // Totales
    rows.push([
      '', 'TOTALES', '', '', '', '', '',
      cut.totals.bonoPuntualidad.toFixed(2),
      cut.totals.bonoObjetivos.toFixed(2),
      cut.totals.apoyoGasolina.toFixed(2),
      cut.totals.total.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Nomina_${cut.startDate}_${cut.endDate}_Q${cut.quincena}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const totals = useMemo(() => {
    return employees.reduce(
      (acc, emp) => {
        const days = daysWorked[emp.id] ?? diasEnPeriodo;
        const s = calculateSalary(emp, days, diasEnPeriodo);
        acc.bonoPuntualidad += s.bonoPuntualidad;
        acc.bonoObjetivos += s.bonoObjetivos;
        acc.apoyoGasolina += s.apoyoGasolina;
        acc.total += s.netoAPagar;
        return acc;
      },
      { bonoPuntualidad: 0, bonoObjetivos: 0, apoyoGasolina: 0, total: 0 }
    );
  }, [employees, daysWorked, diasEnPeriodo]);

  // Para los botones de quincena rápida, derivar año/mes actual de la fecha inicio
  const periodoDate = new Date(selectedPeriod.startDate + 'T00:00:00');
  const currentRefYear = periodoDate.getFullYear();
  const currentRefMonth = periodoDate.getMonth();

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="font-serif text-4xl font-bold text-slate-900">IVAN GUADERRAMA ART</h1>
        <p className="mt-2 text-lg text-slate-700">Nóminas</p>
      </header>

      {/* Period Selector */}
      <Card title="Periodo de Nómina" className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Quincena</label>
            <div className="flex rounded-lg overflow-hidden border border-slate-300">
              <button
                onClick={() => {
                  setSelectedPeriod(getDefaultPeriod(1, currentRefYear, currentRefMonth));
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  selectedPeriod.quincena === 1
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                1ra
              </button>
              <button
                onClick={() => {
                  setSelectedPeriod(getDefaultPeriod(2, currentRefYear, currentRefMonth));
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-slate-300 ${
                  selectedPeriod.quincena === 2
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                2da
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={selectedPeriod.startDate}
              max={selectedPeriod.endDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedPeriod({ ...selectedPeriod, startDate: e.target.value });
                }
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={selectedPeriod.endDate}
              min={selectedPeriod.startDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedPeriod({ ...selectedPeriod, endDate: e.target.value });
                }
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div className="ml-auto">
            <span className="inline-block px-4 py-2 bg-amber-50 text-amber-800 rounded-lg text-sm font-medium border border-amber-200">
              {getPeriodLabel(selectedPeriod)} ({diasEnPeriodo} días)
            </span>
          </div>
        </div>
      </Card>

      {/* Comisiones disponibles */}
      {availableCommissions.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Incluir Comisiones en este Corte</h2>
          <p className="text-sm text-slate-500 mb-4">Selecciona los reportes de comisiones que corresponden a este periodo de nómina.</p>
          <div className="space-y-2">
            {availableCommissions.map(report => (
              <label
                key={report.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedCommissionIds.has(report.id!)
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCommissionIds.has(report.id!)}
                  onChange={() => toggleCommissionReport(report.id!)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-slate-800 text-sm">{report.name}</p>
                  <p className="text-xs text-slate-500">{report.sales?.length || 0} ventas — {report.fileName}</p>
                </div>
                {report.employeeCommissions && (
                  <span className="text-sm font-bold text-amber-800">
                    {formatCurrency(Object.values(report.employeeCommissions).reduce((a, b) => a + (b as number), 0))}
                  </span>
                )}
              </label>
            ))}
          </div>
          {!availableCommissions.some(r => r.employeeCommissions) && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded">
              Los reportes no tienen comisiones por empleado calculadas. Ve al módulo de Comisiones y guarda los reportes con la distribución calculada.
            </p>
          )}
        </Card>
      )}

      {/* Employee Table */}
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Colaboradores ({employees.length})
            {loadingAttendance && <span className="ml-2 text-sm font-normal text-amber-600">Cargando asistencia...</span>}
          </h2>
          {attendanceError && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <strong>Error:</strong> {attendanceError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleDownloadReport}
              disabled={isGenerating || employees.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all"
            >
              Descargar Reporte
            </button>
            {canEdit && (
              <button
                onClick={handleGenerateAll}
                disabled={isGenerating || employees.length === 0}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating && generatingProgress.total > 0
                  ? `Generando ${generatingProgress.current} de ${generatingProgress.total}...`
                  : 'Generar Todos los Recibos'}
              </button>
            )}
          </div>
          {/* placeholder removed */}
        </div>

        <div id="nomina-report-table" className="overflow-x-auto bg-white p-4 rounded-lg">
          <div className="text-center mb-4">
            <h2 className="font-serif text-xl font-bold text-slate-900">IVAN GUADERRAMA ART</h2>
            <p className="text-sm text-slate-600">Reporte de Nómina — {getPeriodLabel(selectedPeriod)}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-2 font-semibold text-slate-600 text-xs">Código</th>
                <th className="text-left py-3 px-2 font-semibold text-slate-600 text-xs">Nombre Completo</th>
                <th className="text-center py-3 px-2 font-semibold text-slate-600 text-xs">Fecha Ingreso</th>
                <th className="text-center py-3 px-2 font-semibold text-slate-600 text-xs">Días Vacaciones</th>
                <th className="text-center py-3 px-2 font-semibold text-slate-600 text-xs">Aplica Vacaciones</th>
                <th className="text-center py-3 px-2 font-semibold text-slate-600 text-xs">Días Trabajados</th>
                <th className="text-right py-3 px-2 font-semibold text-slate-600 text-xs">Bono Puntualidad</th>
                <th className="text-right py-3 px-2 font-semibold text-slate-600 text-xs">Bono Objetivos</th>
                <th className="text-right py-3 px-2 font-semibold text-slate-600 text-xs">Apoyo Gasolina</th>
                {selectedCommissionIds.size > 0 && <>
                  <th className="text-right py-3 px-2 font-semibold text-amber-700 text-xs">Com. Caminata</th>
                  <th className="text-right py-3 px-2 font-semibold text-green-700 text-xs">Com. Semana</th>
                </>}
                <th className="text-right py-3 px-2 font-semibold text-slate-600 text-xs">Total</th>
                {canEdit && <th className="text-center py-3 px-2 font-semibold text-slate-600 text-xs">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const days = daysWorked[emp.id] ?? diasEnPeriodo;
                const salary = calculateSalary(emp, days, diasEnPeriodo);
                const vacation = calculateVacation(emp.fechaIngreso);
                return (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-amber-50/50 transition-colors">
                    <td className="py-3 px-2 font-mono text-xs text-slate-500">{emp.codigo}</td>
                    <td className="py-3 px-2 font-medium text-slate-800 text-sm">{getEmployeeFullName(emp)}</td>
                    <td className="py-3 px-2 text-center text-xs text-slate-600">{formatDateShort(emp.fechaIngreso)}</td>
                    <td className="py-3 px-2 text-center">
                      <span className="font-semibold text-slate-800">{vacation.daysEntitled}</span>
                      <span className="text-xs text-slate-500 ml-1">({vacation.yearsWorked} {vacation.yearsWorked === 1 ? 'año' : 'años'})</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <StatusBadge variant={vacation.eligible ? 'success' : 'error'}>
                        {vacation.eligible ? 'Si aplica' : 'No aplica'}
                      </StatusBadge>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              max={diasEnPeriodo}
                              value={days}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(diasEnPeriodo, parseInt(e.target.value) || 0));
                                setDaysWorked((prev) => ({ ...prev, [emp.id]: val }));
                              }}
                              className={`w-14 text-center px-1 py-1 border rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                                days !== (originalDays[emp.id] ?? diasEnPeriodo) ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
                              }`}
                            />
                          ) : (
                            <span className="text-sm font-medium">{days}</span>
                          )}
                          <span className="text-xs text-slate-400">/{diasEnPeriodo}</span>
                        </div>
                        {days !== (originalDays[emp.id] ?? diasEnPeriodo) && (
                          <div className="w-full">
                            <span className="text-[10px] text-amber-700 font-medium">✏️ Corregido</span>
                            <input
                              type="text"
                              placeholder="Nota..."
                              value={employeeNotes[emp.id] || ''}
                              onChange={(e) => setEmployeeNotes(prev => ({ ...prev, [emp.id]: e.target.value }))}
                              className="mt-0.5 w-full px-1.5 py-0.5 text-[10px] border border-amber-300 rounded bg-amber-50 focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-sm">{formatCurrency(salary.bonoPuntualidad)}</td>
                    <td className="py-3 px-2 text-right text-sm">{formatCurrency(salary.bonoObjetivos)}</td>
                    <td className="py-3 px-2 text-right text-sm">{formatCurrency(salary.apoyoGasolina)}</td>
                    {selectedCommissionIds.size > 0 && (<>
                      <td className="py-3 px-2 text-right text-sm text-amber-700 font-semibold">
                        {formatCurrency(employeeCommissionBreakdown[emp.codigo]?.caminata || 0)}
                      </td>
                      <td className="py-3 px-2 text-right text-sm text-green-700 font-semibold">
                        {formatCurrency(employeeCommissionBreakdown[emp.codigo]?.semana || 0)}
                      </td>
                    </>)}
                    <td className="py-3 px-2 text-right font-bold text-amber-800">
                      {formatCurrency(salary.netoAPagar + (employeeCommissions[emp.codigo] || 0))}
                    </td>
                    {canEdit && (
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handlePreview(emp)}
                          disabled={isGenerating}
                          className="px-3 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-medium hover:bg-amber-200 disabled:opacity-50 transition-colors"
                        >
                          Generar Recibo
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="py-3 px-2 font-bold text-slate-700" colSpan={6}>TOTALES</td>
                <td className="py-3 px-2 text-right font-bold text-slate-700">{formatCurrency(totals.bonoPuntualidad)}</td>
                <td className="py-3 px-2 text-right font-bold text-slate-700">{formatCurrency(totals.bonoObjetivos)}</td>
                <td className="py-3 px-2 text-right font-bold text-slate-700">{formatCurrency(totals.apoyoGasolina)}</td>
                {selectedCommissionIds.size > 0 && (<>
                  <td className="py-3 px-2 text-right font-bold text-amber-700">
                    {formatCurrency(Object.values(employeeCommissionBreakdown).reduce((a, b) => a + b.caminata, 0))}
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-green-700">
                    {formatCurrency(Object.values(employeeCommissionBreakdown).reduce((a, b) => a + b.semana, 0))}
                  </td>
                </>)}
                <td className="py-3 px-2 text-right font-bold text-amber-800 text-base">
                  {formatCurrency(totals.total + Object.values(employeeCommissions).reduce((a, b) => a + b, 0))}
                </td>
                {canEdit && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>

        {employees.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No hay colaboradores registrados.
          </div>
        )}
      </Card>

      {/* Guardar Corte + Cortes Guardados */}
      {canEdit && (
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Cortes de Nomina</h2>
              <p className="text-xs text-slate-500">Guarda el corte actual para conservar los calculos y descargarlos en Excel.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveDraft}
                disabled={savingCut || employees.length === 0 || !!attendanceError || loadingAttendance}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                {savingCut ? 'Guardando...' : currentCutId ? 'Actualizar Borrador' : 'Guardar Borrador'}
              </button>
              <button
                onClick={handleClosePeriod}
                disabled={savingCut || employees.length === 0 || !!attendanceError || loadingAttendance}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg text-sm font-medium hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Cerrar Periodo
              </button>
              <button
                onClick={() => setShowSavedCuts(!showSavedCuts)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                Cortes Guardados ({savedCuts.length})
              </button>
            </div>
          </div>

          {showSavedCuts && (
            <div className="border-t border-slate-200 pt-4">
              {savedCuts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No hay cortes guardados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 font-semibold text-slate-600 text-xs">Periodo</th>
                        <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Quincena</th>
                        <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Empleados</th>
                        <th className="text-right py-2 px-3 font-semibold text-slate-600 text-xs">Total Nomina</th>
                        <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Guardado por</th>
                        <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Fecha</th>
                        <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Estado</th>
                        <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedCuts.map(cut => (
                        <tr key={cut.id} className="border-b border-slate-100 hover:bg-amber-50/50">
                          <td className="py-2.5 px-3 text-slate-800 font-medium">{cut.periodLabel}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">Q{cut.quincena}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">{cut.employees.length}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-800">{formatCurrency(cut.totals.total)}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-slate-500">{cut.createdBy?.split('@')[0]}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-slate-500">
                            {new Date(cut.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {cut.status === 'cerrado' ? (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">🔒 Cerrado</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">📝 Borrador</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => handleLoadDraft(cut)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium hover:bg-blue-200 transition-colors"
                              >
                                {cut.status === 'cerrado' ? 'Ver' : 'Cargar'}
                              </button>
                              <button
                                onClick={() => handleDownloadExcel(cut)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium hover:bg-green-200 transition-colors"
                                title="Descargar Excel"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Excel
                              </button>
                              <button
                                onClick={() => cut.id && payrollCutsService.remove(cut.id)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar corte"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Modal de Vista Previa del Recibo */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !isGenerating && setSelectedEmployee(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">
                {getEmployeeFullName(selectedEmployee)}
              </h2>
              <button
                onClick={() => setSelectedEmployee(null)}
                disabled={isGenerating}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview */}
            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              <div>
                  <NominasPdfPreview
                    employee={selectedEmployee}
                    period={selectedPeriod}
                    diasTrabajados={daysWorked[selectedEmployee.id] ?? diasEnPeriodo}
                    comision={employeeCommissions[selectedEmployee.codigo] || 0}
                    comisionDesglose={employeeCommissionBreakdown[selectedEmployee.codigo]}
                    comisionLabels={commissionLabels}
                  />
              </div>
            </div>

            {/* Footer con botones */}
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
              <button
                onClick={() => setSelectedEmployee(null)}
                disabled={isGenerating}
                className="px-4 py-2 text-sm text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={isGenerating}
                className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-600 to-orange-600 rounded-lg hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? 'Descargando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Versión oculta para generación de PDF (tamaño carta fijo) */}
      {selectedEmployee && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <NominasPdfPreview
            employee={selectedEmployee}
            period={selectedPeriod}
            diasTrabajados={daysWorked[selectedEmployee.id] ?? diasEnPeriodo}
            comision={employeeCommissions[selectedEmployee.codigo] || 0}
            comisionDesglose={employeeCommissionBreakdown[selectedEmployee.codigo]}
            comisionLabels={commissionLabels}
            forPdf
          />
        </div>
      )}
    </div>
  );
};
