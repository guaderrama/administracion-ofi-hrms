import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { employeesService } from '../src/services/firestoreService';
import { NominasPdfPreview } from './NominasPdfPreview';
import {
  PayrollPeriod,
  getCurrentPeriod,
  getPeriodLabel,
  getMonthName,
  calculateSalary,
  calculateVacation,
  formatCurrency,
  formatDateShort,
  getEmployeeFullName,
} from './nominasUtils';
import type { DetailedEmployee } from '../types';

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

  useEffect(() => {
    const unsubscribe = employeesService.subscribe((emps) => setEmployees(emps));
    return () => unsubscribe();
  }, []);

  // Access control
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600 mb-4">Debes iniciar sesión para acceder a esta sección.</p>
          <button onClick={() => setView('dashboard')} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Acceso Denegado</h2>
          <p className="text-slate-600 mb-4">No tienes permisos de administrador para acceder a Nóminas.</p>
          <button onClick={() => setView('dashboard')} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  const generatePdf = async (employee: DetailedEmployee) => {
    // Wait for React to render the preview
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

    const periodStr = `${selectedPeriod.year}_${String(selectedPeriod.month + 1).padStart(2, '0')}_Q${selectedPeriod.quincena}`;
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
        const s = calculateSalary(emp);
        acc.bonoPuntualidad += s.bonoPuntualidad;
        acc.bonoObjetivos += s.bonoObjetivos;
        acc.apoyoGasolina += s.apoyoGasolina;
        acc.total += s.netoAPagar;
        return acc;
      },
      { bonoPuntualidad: 0, bonoObjetivos: 0, apoyoGasolina: 0, total: 0 }
    );
  }, [employees]);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1];
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="font-serif text-4xl font-bold text-slate-900">IVAN GUADERRAMA ART</h1>
        <p className="mt-2 text-lg text-slate-700">Nóminas</p>
      </header>

      {/* Period Selector */}
      <div className="bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Periodo de Nómina</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Año</label>
            <select
              value={selectedPeriod.year}
              onChange={(e) => setSelectedPeriod({ ...selectedPeriod, year: parseInt(e.target.value) })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Mes</label>
            <select
              value={selectedPeriod.month}
              onChange={(e) => setSelectedPeriod({ ...selectedPeriod, month: parseInt(e.target.value) })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {months.map(m => (
                <option key={m} value={m}>{getMonthName(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Quincena</label>
            <div className="flex rounded-lg overflow-hidden border border-slate-300">
              <button
                onClick={() => setSelectedPeriod({ ...selectedPeriod, quincena: 1 })}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  selectedPeriod.quincena === 1
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                1ra (1-15)
              </button>
              <button
                onClick={() => setSelectedPeriod({ ...selectedPeriod, quincena: 2 })}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-slate-300 ${
                  selectedPeriod.quincena === 2
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                2da (16-fin)
              </button>
            </div>
          </div>
          <div className="ml-auto">
            <span className="inline-block px-4 py-2 bg-amber-50 text-amber-800 rounded-lg text-sm font-medium border border-amber-200">
              {getPeriodLabel(selectedPeriod)}
            </span>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Colaboradores ({employees.length})
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
                <th className="text-right py-3 px-2 font-semibold text-slate-600 text-xs">Bono Puntualidad</th>
                <th className="text-right py-3 px-2 font-semibold text-slate-600 text-xs">Bono Objetivos</th>
                <th className="text-right py-3 px-2 font-semibold text-slate-600 text-xs">Apoyo Gasolina</th>
                <th className="text-right py-3 px-2 font-semibold text-slate-600 text-xs">Total</th>
                <th className="text-center py-3 px-2 font-semibold text-slate-600 text-xs">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const salary = calculateSalary(emp);
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
                      {vacation.eligible ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Si aplica
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          No aplica
                        </span>
                      )}
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
                <td className="py-3 px-2 font-bold text-slate-700" colSpan={5}>TOTALES</td>
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
      </div>

      {/* PDF Preview (hidden off-screen for capture, visible when selected) */}
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
              <NominasPdfPreview employee={selectedEmployee} period={selectedPeriod} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
