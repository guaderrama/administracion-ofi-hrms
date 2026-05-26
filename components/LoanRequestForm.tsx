import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { LoanRequest, DetailedEmployee } from '../types';
import { useToast } from './ui/Toast';
import { useAuth } from '../src/contexts/AuthContext';
import { employeesService } from '../src/services/firestoreService';

// Formato de nombre completo para el selector
const getFullName = (emp: DetailedEmployee) => `${emp.paterno} ${emp.materno} ${emp.nombres}`;

interface LoanRequestFormProps {
  onSubmit: (data: LoanRequest) => void;
  isGenerating: boolean;
}

const InputField: React.FC<{ label: string; id: string; type?: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean; readOnly?: boolean; placeholder?: string; min?: number; step?: number; }> = React.memo(({ label, id, type = 'text', value, onChange, required = true, readOnly = false, placeholder, min, step }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
        <input
            type={type}
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            required={required}
            readOnly={readOnly}
            placeholder={placeholder}
            min={min}
            step={step}
            className={`mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm ${readOnly ? 'bg-slate-100/70 cursor-not-allowed' : 'bg-white/40'}`}
        />
    </div>
));

function calculateTenure(fechaIngreso: string): { years: number; months: number; label: string } {
  if (!fechaIngreso) return { years: 0, months: 0, label: 'N/A' };
  const start = new Date(fechaIngreso + 'T12:00:00');
  const today = new Date();
  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (today.getDate() < start.getDate()) { months--; if (months < 0) { years--; months += 12; } }
  const parts = [];
  if (years > 0) parts.push(`${years} año${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mes${months > 1 ? 'es' : ''}`);
  return { years, months, label: parts.length > 0 ? parts.join(', ') : 'Menos de un mes' };
}

export const LoanRequestForm: React.FC<LoanRequestFormProps> = ({ onSubmit, isGenerating }) => {
  const toast = useToast();
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const { isAdmin } = useAuth();
  const [employee, setEmployee] = useState<DetailedEmployee | null>(null);
  const [allEmployees, setAllEmployees] = useState<DetailedEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Omit<LoanRequest, 'loanAmount' | 'installments'> & { loanAmount: string; installments: string }>({
    firstName: '',
    lastName: '',
    motherLastName: '',
    requestDate: today,
    loanAmount: '',
    installments: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Cargar empleados y auto-detectar por email
  useEffect(() => {
    const unsubscribe = employeesService.subscribe((employees) => {
      setAllEmployees(employees);

      // Si NO es admin, buscar por email del usuario logueado
      if (!isAdmin && user?.email) {
        const match = employees.find(
          emp => emp.email?.toLowerCase() === user.email!.toLowerCase()
        );
        if (match) {
          selectEmployee(match);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.email, isAdmin]);

  const selectEmployee = (emp: DetailedEmployee) => {
    setEmployee(emp);
    setFormData(prev => ({
      ...prev,
      firstName: emp.nombres,
      lastName: emp.paterno,
      motherLastName: emp.materno,
    }));
  };

  const handleEmployeeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const empId = e.target.value;
    if (!empId) { setEmployee(null); return; }
    const match = allEmployees.find(emp => emp.id === empId);
    if (match) selectEmployee(match);
  };

  // Calcular salario quincenal y antigüedad
  const tenure = useMemo(() => employee ? calculateTenure(employee.fechaIngreso) : null, [employee]);

  const biweeklySalary = useMemo(() => {
    if (!employee) return 0;
    const monthly = (employee.bonoPuntualidad || 0) + (employee.bonoObjetivos || 0) + (employee.apoyoGasolina || 0);
    return Math.round((monthly / 2) * 100) / 100;
  }, [employee]);

  // Max descuento quincenal: 30% del salario quincenal
  const maxBiweeklyPayment = useMemo(() => Math.round(biweeklySalary * 0.3 * 100) / 100, [biweeklySalary]);

  const biweeklyPayment = useMemo(() => {
    const amount = parseFloat(formData.loanAmount);
    const inst = parseInt(formData.installments, 10);
    if (amount > 0 && inst > 0) return Math.round((amount / inst) * 100) / 100;
    return 0;
  }, [formData.loanAmount, formData.installments]);

  const exceedsLimit = biweeklyPayment > maxBiweeklyPayment && maxBiweeklyPayment > 0;

  // Opciones sugeridas de plazo según monto y salario
  const suggestedInstallments = useMemo(() => {
    const amount = parseFloat(formData.loanAmount);
    if (!amount || amount <= 0 || maxBiweeklyPayment <= 0) return [];
    const minInstallments = Math.ceil(amount / maxBiweeklyPayment);
    const options = [minInstallments];
    // Agregar opciones con pagos más cómodos
    for (const mult of [1.5, 2, 3]) {
      const opt = Math.ceil(minInstallments * mult);
      if (opt > minInstallments && opt <= 24 && !options.includes(opt)) options.push(opt);
    }
    return options;
  }, [formData.loanAmount, maxBiweeklyPayment]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.warning('Debe aceptar los términos y condiciones para continuar.');
      return;
    }
    if (exceedsLimit) {
      toast.warning(`El descuento quincenal ($${biweeklyPayment.toFixed(2)}) excede el 30% de tu salario quincenal ($${maxBiweeklyPayment.toFixed(2)}). Aumenta el plazo.`);
      return;
    }
    onSubmit({
      ...formData,
      loanAmount: parseFloat(formData.loanAmount) || 0,
      installments: parseInt(formData.installments, 10) || 0,
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
        Cargando datos del colaborador...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos del Colaborador (auto-llenados) */}
      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg leading-6 font-medium text-slate-800">Datos del Colaborador</h3>
          {employee && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Auto-cargado
            </span>
          )}
        </div>

        <InputField label="Fecha de Solicitud" id="requestDate" type="date" value={formData.requestDate} onChange={handleChange} />

        {/* Admin: selector de empleado. Empleado: auto-detectado por email */}
        {isAdmin && (
          <div>
            <label htmlFor="employeeSelect" className="block text-sm font-medium text-slate-700">Seleccionar Colaborador</label>
            <select
              id="employeeSelect"
              value={employee?.id || ''}
              onChange={handleEmployeeSelect}
              className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm"
            >
              <option value="">-- Seleccionar colaborador --</option>
              {allEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{getFullName(emp)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField label="Nombre(s)" id="firstName" value={formData.firstName} onChange={handleChange} readOnly={!!employee} />
          <InputField label="Apellido Paterno" id="lastName" value={formData.lastName} onChange={handleChange} readOnly={!!employee} />
          <InputField label="Apellido Materno" id="motherLastName" value={formData.motherLastName} onChange={handleChange} readOnly={!!employee} />
        </div>

        {employee && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/50">
            <div>
              <label className="block text-sm font-medium text-slate-700">Fecha de Ingreso</label>
              <p className="mt-1 px-3 py-2 bg-slate-100/70 border border-slate-300 rounded-md text-sm text-slate-800">
                {new Date(employee.fechaIngreso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Antigüedad</label>
              <p className="mt-1 px-3 py-2 bg-slate-100/70 border border-slate-300 rounded-md text-sm text-slate-800">
                {tenure?.label}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Percepciones quincenales (solo si hay empleado) */}
      {employee && biweeklySalary > 0 && (
        <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
          <h3 className="text-lg leading-6 font-medium text-slate-800">Percepciones Quincenales</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {employee.bonoPuntualidad > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500">Bono Puntualidad</label>
                <p className="mt-1 text-sm font-semibold text-slate-800">${(employee.bonoPuntualidad / 2).toFixed(2)}</p>
              </div>
            )}
            {employee.bonoObjetivos > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500">Bono Objetivos</label>
                <p className="mt-1 text-sm font-semibold text-slate-800">${(employee.bonoObjetivos / 2).toFixed(2)}</p>
              </div>
            )}
            {employee.apoyoGasolina > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500">Apoyo Gasolina</label>
                <p className="mt-1 text-sm font-semibold text-slate-800">${(employee.apoyoGasolina / 2).toFixed(2)}</p>
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700">Total Quincenal</span>
            <span className="text-lg font-bold text-slate-900">${biweeklySalary.toFixed(2)} MXN</span>
          </div>
          <p className="text-xs text-slate-500">
            Descuento máximo permitido (30%): <strong>${maxBiweeklyPayment.toFixed(2)} MXN</strong> por quincena
          </p>
        </div>
      )}

      {/* Detalles del Préstamo */}
      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Detalles del Préstamo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Monto del Préstamo (MXN)"
            id="loanAmount"
            type="number"
            value={formData.loanAmount}
            onChange={handleChange}
            placeholder="Ej: 5000"
            min={1}
            step={0.01}
          />
          <div>
            <InputField
              label="Plazo de Pago (quincenas)"
              id="installments"
              type="number"
              value={formData.installments}
              onChange={handleChange}
              placeholder="Ej: 10"
              min={1}
            />
            {suggestedInstallments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-500">Plazos sugeridos:</span>
                {suggestedInstallments.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, installments: String(n) }))}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                      formData.installments === String(n)
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : 'bg-white/60 border-slate-300 text-slate-600 hover:bg-amber-50'
                    }`}
                  >
                    {n} qnas
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Descuento quincenal estimado</label>
          <div className={`mt-1 p-3 rounded-md border text-center font-mono text-lg ${
            exceedsLimit
              ? 'bg-red-50 border-red-300 text-red-700'
              : 'bg-slate-100/50 border-slate-300/50 text-slate-800'
          }`}>
            ${biweeklyPayment.toFixed(2)} MXN
          </div>
          {exceedsLimit && (
            <p className="mt-1 text-xs text-red-600">
              Excede el 30% de tu salario quincenal (${maxBiweeklyPayment.toFixed(2)}). Aumenta el plazo de pago.
            </p>
          )}
        </div>
      </div>

      {/* Acuerdo */}
      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Acuerdo</h3>
        <div className="relative flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="termsAccepted"
              name="termsAccepted"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="termsAccepted" className="font-medium text-slate-700">
              Aceptación de Términos
            </label>
            <p className="text-slate-500">
              He leído y acepto los términos y condiciones para el descuento vía nómina.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isGenerating || !termsAccepted || exceedsLimit}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:from-amber-400 disabled:to-orange-400 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generando...' : 'Generar Vista Previa'}
        </button>
      </div>
    </form>
  );
};
