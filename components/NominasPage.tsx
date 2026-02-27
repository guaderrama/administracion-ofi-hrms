import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { employeesService, logsService } from '../src/services/firestoreService';
import { NominasPdfPreview } from './NominasPdfPreview';
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
  const { isAdmin, user } = useAuth();
  const [employees, setEmployees] = useState<DetailedEmployee[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod>(getCurrentPeriod());
  const [selectedEmployee, setSelectedEmployee] = useState<DetailedEmployee | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 });
  const [daysWorked, setDaysWorked] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = employeesService.subscribe((emps) => setEmployees(emps));
    return () => unsubscribe();
  }, []);

  const diasEnPeriodo = getDaysInQuincena(selectedPeriod);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Calcular días trabajados desde registros de asistencia
  useEffect(() => {
    if (employees.length === 0) return;

    const fetchAttendance = async () => {
      setLoadingAttendance(true);
      try {
        const startDate = new Date(selectedPeriod.startDate + 'T00:00:00');
        const endDate = new Date(selectedPeriod.endDate + 'T23:59:59');
        const logs = await logsService.getByDateRange(startDate, endDate);

        // Filtrar solo entradas
        const entradas = logs.filter((log: LogEntry) => log.type === LogType.ENTRADA);

        // Calcular días de descanso en el periodo (domingos + sábados según horario)
        const sundaysInPeriod: string[] = [];
        const saturdaysInPeriod: string[] = [];
        const cursor = new Date(selectedPeriod.startDate + 'T00:00:00');
        const endLimit = new Date(selectedPeriod.endDate + 'T00:00:00');
        while (cursor <= endLimit) {
          const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
          if (cursor.getDay() === 0) sundaysInPeriod.push(key);   // Domingo
          if (cursor.getDay() === 6) saturdaysInPeriod.push(key); // Sábado
          cursor.setDate(cursor.getDate() + 1);
        }

        // Contar días únicos con entrada por empleado + días de descanso pagados
        const updated: Record<string, number> = {};
        employees.forEach((emp) => {
          const empFullName = `${emp.paterno} ${emp.materno} ${emp.nombres}`.toUpperCase().trim();

          // Buscar logs que coincidan con este empleado
          const empEntradas = entradas.filter((log: LogEntry) => {
            const logName = log.employeeName.toUpperCase().trim();
            return logName === empFullName ||
              (logName.includes(emp.paterno.toUpperCase()) &&
               logName.includes(emp.nombres.toUpperCase()));
          });

          // Días únicos con entrada
          const workedDays = new Set(
            empEntradas.map((log: LogEntry) => {
              const d = new Date(log.timestamp);
              return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            })
          );

          // Domingos siempre se pagan como descanso
          sundaysInPeriod.forEach((d) => workedDays.add(d));

          // Sábados se pagan si el empleado no labora ese día
          const noLaboraSabado = emp.horarioSabado?.toLowerCase().includes('no labora');
          if (noLaboraSabado) {
            saturdaysInPeriod.forEach((d) => workedDays.add(d));
          }

          updated[emp.id] = Math.min(workedDays.size, diasEnPeriodo);
        });

        setDaysWorked(updated);
      } catch (error) {
        console.error('Error cargando asistencia:', error);
        // Fallback: poner todos los días del periodo
        const fallback: Record<string, number> = {};
        employees.forEach((emp) => { fallback[emp.id] = diasEnPeriodo; });
        setDaysWorked(fallback);
      } finally {
        setLoadingAttendance(false);
      }
    };

    fetchAttendance();
  }, [employees, selectedPeriod.startDate, selectedPeriod.endDate, diasEnPeriodo]);

  if (!user) {
    return <AccessDenied icon="🔒" title="Acceso Restringido" message="Debes iniciar sesión para acceder a esta sección." onBack={() => setView('dashboard')} />;
  }

  if (!isAdmin) {
    return <AccessDenied message="No tienes permisos de administrador para acceder a Nóminas." onBack={() => setView('dashboard')} />;
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
      format: 'a4',
    });

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    const periodStr = `${selectedPeriod.startDate}_${selectedPeriod.endDate}_Q${selectedPeriod.quincena}`;
    const fileName = `nomina_${employee.paterno}_${employee.materno}_${employee.nombres}_${periodStr}.pdf`.replace(/\s/g, '_');
    pdf.save(fileName);
  };

  const handleGenerateSingle = async (employee: DetailedEmployee) => {
    setSelectedEmployee(employee);
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      await generatePdf(employee);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
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

      {/* Employee Table */}
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Colaboradores ({employees.length})
            {loadingAttendance && <span className="ml-2 text-sm font-normal text-amber-600">Cargando asistencia...</span>}
          </h2>
          <button
            onClick={handleGenerateAll}
            disabled={isGenerating || employees.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isGenerating && generatingProgress.total > 0
              ? `Generando ${generatingProgress.current} de ${generatingProgress.total}...`
              : 'Generar Todos los Recibos'}
          </button>
        </div>

        <div className="overflow-x-auto">
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
                <th className="text-right py-3 px-2 font-semibold text-slate-600 text-xs">Total</th>
                <th className="text-center py-3 px-2 font-semibold text-slate-600 text-xs">Acciones</th>
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
                      <input
                        type="number"
                        min={0}
                        max={diasEnPeriodo}
                        value={days}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(diasEnPeriodo, parseInt(e.target.value) || 0));
                          setDaysWorked((prev) => ({ ...prev, [emp.id]: val }));
                        }}
                        className="w-14 text-center px-1 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                      <span className="text-xs text-slate-400 ml-1">/{diasEnPeriodo}</span>
                    </td>
                    <td className="py-3 px-2 text-right text-sm">{formatCurrency(salary.bonoPuntualidad)}</td>
                    <td className="py-3 px-2 text-right text-sm">{formatCurrency(salary.bonoObjetivos)}</td>
                    <td className="py-3 px-2 text-right text-sm">{formatCurrency(salary.apoyoGasolina)}</td>
                    <td className="py-3 px-2 text-right font-bold text-amber-800">{formatCurrency(salary.netoAPagar)}</td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => handleGenerateSingle(emp)}
                        disabled={isGenerating}
                        className="px-3 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-medium hover:bg-amber-200 disabled:opacity-50 transition-colors"
                      >
                        Generar Recibo
                      </button>
                    </td>
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
                <td className="py-3 px-2 text-right font-bold text-amber-800 text-base">{formatCurrency(totals.total)}</td>
                <td></td>
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

      {/* PDF Preview */}
      {selectedEmployee && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              Vista Previa - {getEmployeeFullName(selectedEmployee)}
            </h2>
            {!isGenerating && (
              <button
                onClick={() => setSelectedEmployee(null)}
                className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cerrar Vista Previa
              </button>
            )}
          </div>
          <div className="overflow-auto border border-slate-200 rounded-xl bg-white shadow-inner" style={{ maxHeight: '600px' }}>
            <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left', width: '142.8%' }}>
              <NominasPdfPreview
                employee={selectedEmployee}
                period={selectedPeriod}
                diasTrabajados={daysWorked[selectedEmployee.id] ?? diasEnPeriodo}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
