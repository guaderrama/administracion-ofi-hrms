import React, { useState, useEffect, useCallback } from 'react';
import type { VacationRequest, DetailedEmployee } from '../types';
import { calculateVacationDays } from '../utils/vacationCalculator';
import { employeesService, vacationRequestsService } from '../src/services/firestoreService';
import { useAuth } from '../src/contexts/AuthContext';
import { useToast } from './ui/Toast';

interface VacationFormProps {
  onSubmit: (data: VacationRequest) => void;
  isGenerating: boolean;
}

const InputField: React.FC<{ label: string; id: string; type?: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean; readOnly?: boolean; extraInfo?: string }> = React.memo(({ label, id, type = 'text', value, onChange, required = true, readOnly = false, extraInfo }) => (
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
            className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm read-only:bg-slate-100/50 read-only:cursor-not-allowed"
        />
        {extraInfo && <p className="mt-1 text-xs text-slate-500">{extraInfo}</p>}
    </div>
));


// Dias de descanso obligatorio segun la Ley Federal del Trabajo (Mexico)
// Incluye dias fijos + dias que cambian por decreto (lunes mas cercano)
function getOfficialHolidays(year: number): string[] {
  const holidays: string[] = [];
  const pad = (n: number) => n.toString().padStart(2, '0');
  const fmt = (m: number, d: number) => `${year}-${pad(m)}-${pad(d)}`;

  // 1 enero - Año Nuevo
  holidays.push(fmt(1, 1));
  // Primer lunes de febrero - Dia de la Constitucion
  const feb1 = new Date(year, 1, 1);
  const firstMonFeb = 1 + ((8 - feb1.getDay()) % 7);
  holidays.push(fmt(2, firstMonFeb));
  // Tercer lunes de marzo - Natalicio de Benito Juarez
  const mar1 = new Date(year, 2, 1);
  const firstMonMar = 1 + ((8 - mar1.getDay()) % 7);
  holidays.push(fmt(3, firstMonMar + 14));
  // 1 mayo - Dia del Trabajo
  holidays.push(fmt(5, 1));
  // 16 septiembre - Dia de la Independencia
  holidays.push(fmt(9, 16));
  // Tercer lunes de noviembre - Revolucion Mexicana
  const nov1 = new Date(year, 10, 1);
  const firstMonNov = 1 + ((8 - nov1.getDay()) % 7);
  holidays.push(fmt(11, firstMonNov + 14));
  // 25 diciembre - Navidad
  holidays.push(fmt(12, 25));
  // 1 octubre cada 6 anos - Transmision del Poder Ejecutivo (2024, 2030...)
  if (year % 6 === 0 || (year - 2024) % 6 === 0) {
    holidays.push(fmt(10, 1));
  }

  return holidays;
}

function getHolidayName(dateStr: string): string | null {
  const md = dateStr.slice(5); // MM-DD
  const year = parseInt(dateStr.slice(0, 4));
  const holidays = getOfficialHolidays(year);
  if (!holidays.includes(dateStr)) return null;

  if (md === '01-01') return 'Ano Nuevo';
  if (md.startsWith('02-')) return 'Dia de la Constitucion';
  if (md.startsWith('03-')) return 'Natalicio de Benito Juarez';
  if (md === '05-01') return 'Dia del Trabajo';
  if (md === '09-16') return 'Dia de la Independencia';
  if (md.startsWith('11-')) return 'Revolucion Mexicana';
  if (md === '12-25') return 'Navidad';
  if (md === '10-01') return 'Transmision del Poder Ejecutivo';
  return 'Dia Feriado Oficial';
}

export const VacationForm: React.FC<VacationFormProps> = ({ onSubmit, isGenerating }) => {
  const toast = useToast();
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [usedDays, setUsedDays] = useState(0);
  const [savingRequest, setSavingRequest] = useState(false);
  const [formData, setFormData] = useState<VacationRequest>({
    firstName: '',
    lastName: '',
    motherLastName: '',
    requestDate: today,
    hireDate: '',
    vacationDaysEntitled: 0,
    dates: [],
    daysRequested: 0,
    daysRemaining: 0,
    additionalNotes: '',
  });

  const [employeeCode, setEmployeeCode] = useState('');
  const [employees, setEmployees] = useState<DetailedEmployee[]>([]);
  const [codeStatus, setCodeStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
  const [dateToAdd, setDateToAdd] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [excludeSaturdays, setExcludeSaturdays] = useState(false);

  // Cargar empleados desde Firestore
  useEffect(() => {
    const unsubscribe = employeesService.subscribe((emps) => setEmployees(emps));
    return () => unsubscribe();
  }, []);

  // Buscar empleado por código
  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    setEmployeeCode(code);

    if (!code.trim()) {
      setCodeStatus('idle');
      setFormData(prev => ({
        ...prev,
        firstName: '',
        lastName: '',
        motherLastName: '',
        hireDate: '',
      }));
      return;
    }

    const found = employees.find(emp => emp.codigo === code.trim());
    if (found) {
      setCodeStatus('found');
      setFormData(prev => ({
        ...prev,
        firstName: found.nombres,
        lastName: found.paterno,
        motherLastName: found.materno,
        hireDate: found.fechaIngreso,
      }));
      // Cargar dias ya usados
      vacationRequestsService.getUsedDaysByEmployee(code.trim()).then(days => setUsedDays(days));
    } else {
      setCodeStatus('not_found');
    }
  }, [employees]);

  useEffect(() => {
    const entitledDays = calculateVacationDays(formData.hireDate, formData.requestDate);
    const availableDays = entitledDays - usedDays;
    const requestedDays = formData.dates.length;
    setFormData(prev => ({
      ...prev,
      vacationDaysEntitled: availableDays,
      daysRequested: requestedDays,
      daysRemaining: availableDays - requestedDays
    }));
  }, [formData.hireDate, formData.requestDate, formData.dates, usedDays]);

  const updateDates = useCallback((newDates: string[]) => {
    setFormData(prev => ({
        ...prev,
        dates: newDates,
    }));
  }, []);

  const handleAddDate = useCallback(() => {
    if (dateToAdd && !formData.dates.includes(dateToAdd)) {
        const selectedDate = new Date(dateToAdd + 'T12:00:00');
        if (selectedDate.getDay() === 0) {
          toast.warning('El domingo es dia de descanso y no puede ser seleccionado.');
          return;
        }
        if (excludeSaturdays && selectedDate.getDay() === 6) {
          toast.warning('El sabado ha sido marcado como dia de descanso.');
          return;
        }
        const holidayName = getHolidayName(dateToAdd);
        if (holidayName) {
          toast.warning(`${dateToAdd.slice(5)} es "${holidayName}" (dia feriado oficial). No cuenta como dia de vacaciones.`);
          return;
        }
        const newDates = [...formData.dates, dateToAdd].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        updateDates(newDates);
        setDateToAdd('');
    }
  }, [dateToAdd, formData.dates, updateDates, excludeSaturdays]);
  
  const handleAddPeriod = useCallback(() => {
    if (!startDate || !endDate) return;

    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    
    if (start > end) {
        toast.warning('La fecha de inicio no puede ser posterior a la fecha de fin.');
        return;
    }

    const newDatesInRange = [];
    const skippedHolidays: string[] = [];
    const currentDate = new Date(start);
    // Obtener feriados para todos los anos del rango
    const yearsInRange = new Set<number>();
    const cursor2 = new Date(start);
    while (cursor2 <= end) { yearsInRange.add(cursor2.getFullYear()); cursor2.setDate(cursor2.getDate() + 1); }
    const allHolidays = new Set<string>();
    yearsInRange.forEach(y => getOfficialHolidays(y).forEach(h => allHolidays.add(h)));

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().slice(0, 10);
      const isWeekendToExclude = dayOfWeek === 0 || (excludeSaturdays && dayOfWeek === 6);
      const isHoliday = allHolidays.has(dateStr);

      if (isHoliday) {
        skippedHolidays.push(dateStr);
      } else if (!isWeekendToExclude) {
        newDatesInRange.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (skippedHolidays.length > 0) {
      const names = skippedHolidays.map(d => `${getHolidayName(d)} (${new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })})`).join(', ');
      toast.info(`Se excluyeron ${skippedHolidays.length} dia(s) feriado(s): ${names}`);
    }
    
    const allDates = [...new Set([...formData.dates, ...newDatesInRange])].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    updateDates(allDates);
    setStartDate('');
    setEndDate('');
  }, [startDate, endDate, formData.dates, updateDates, excludeSaturdays]);

  const handleRemoveDate = useCallback((dateToRemove: string) => {
    const newDates = formData.dates.filter(d => d !== dateToRemove);
    updateDates(newDates);
  }, [formData.dates, updateDates]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(formData.daysRequested > formData.vacationDaysEntitled){
      toast.error('Has seleccionado mas dias de los que te corresponden. Por favor, ajusta las fechas.');
      return;
    }
    if (formData.dates.length === 0) {
      toast.warning('Selecciona al menos un dia de vacaciones.');
      return;
    }

    setSavingRequest(true);
    try {
      // Buscar empleado para obtener ID
      const emp = employees.find(e => e.codigo === employeeCode.trim());
      await vacationRequestsService.create({
        employeeId: emp?.id || '',
        employeeCode: employeeCode.trim(),
        employeeName: `${formData.firstName} ${formData.lastName} ${formData.motherLastName}`.trim(),
        hireDate: formData.hireDate,
        dates: formData.dates,
        daysRequested: formData.daysRequested,
        daysEntitled: formData.vacationDaysEntitled,
        notes: formData.additionalNotes || '',
        status: 'pendiente',
        createdBy: user?.email || '',
        createdAt: new Date(),
      });
      // Actualizar dias usados localmente
      setUsedDays(prev => prev + formData.daysRequested);
      toast.success(`Solicitud de ${formData.daysRequested} dias de vacaciones registrada.`);
      onSubmit(formData);
    } catch (err) {
      console.error('Error al guardar solicitud:', err);
      toast.error('Error al guardar la solicitud.');
    } finally {
      setSavingRequest(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Datos del Colaborador</h3>
        <InputField label="Fecha de Solicitud" id="requestDate" type="date" value={formData.requestDate} onChange={handleChange} />
        <div>
          <label htmlFor="employeeCode" className="block text-sm font-medium text-slate-700">Código de Empleado</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="text"
              id="employeeCode"
              value={employeeCode}
              onChange={handleCodeChange}
              placeholder="Ingresa tu código"
              className="block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm"
            />
            {codeStatus === 'found' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">
                Encontrado
              </span>
            )}
            {codeStatus === 'not_found' && employeeCode.trim() && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">
                No encontrado
              </span>
            )}
          </div>
          {codeStatus === 'not_found' && employeeCode.trim() && (
            <p className="mt-1 text-xs text-red-600">No se encontró un colaborador con ese código. Verifica e intenta de nuevo.</p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField label="Nombre(s)" id="firstName" value={formData.firstName} onChange={handleChange} readOnly={codeStatus === 'found'} />
            <InputField label="Apellido Paterno" id="lastName" value={formData.lastName} onChange={handleChange} readOnly={codeStatus === 'found'} />
            <InputField label="Apellido Materno" id="motherLastName" value={formData.motherLastName} onChange={handleChange} readOnly={codeStatus === 'found'} />
        </div>
        <InputField label="Fecha de Ingreso a la Empresa" id="hireDate" type="date" value={formData.hireDate} onChange={handleChange} readOnly={codeStatus === 'found'} />
      </div>
      
      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Cálculo de Días de Vacaciones</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-black/5 rounded-lg border border-slate-300/50">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Dias por Ley</p>
            <p className="text-2xl font-bold text-slate-500">{calculateVacationDays(formData.hireDate, formData.requestDate)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Dias Usados</p>
            <p className="text-2xl font-bold text-orange-600">{usedDays}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Disponibles</p>
            <p className="text-2xl font-bold text-amber-700">{formData.vacationDaysEntitled}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Restantes</p>
            <p className={`text-2xl font-bold ${formData.daysRemaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formData.daysRemaining}</p>
          </div>
        </div>
        {usedDays > 0 && (
          <p className="text-xs text-slate-500 text-center">Ya has utilizado {usedDays} dia{usedDays !== 1 ? 's' : ''} de vacaciones este periodo.</p>
        )}
        {formData.daysRemaining < 0 && <p className="text-sm text-red-600 font-medium text-center">Advertencia: Estas solicitando mas dias de los que te corresponden.</p>}
      </div>

      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Selección de Fechas</h3>
        
        <div className="relative flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="excludeSaturdays"
              aria-describedby="excludeSaturdays-description"
              name="excludeSaturdays"
              type="checkbox"
              checked={excludeSaturdays}
              onChange={(e) => setExcludeSaturdays(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="excludeSaturdays" className="font-medium text-slate-700">
              Descanso Sábados
            </label>
            <p id="excludeSaturdays-description" className="text-slate-500">
              Marca esta casilla si los sábados son días de descanso.
            </p>
          </div>
        </div>

         <div className="p-4 bg-black/5 border border-slate-300/50 rounded-lg space-y-4">
            <div>
                <label htmlFor="date-picker" className="block text-sm font-medium text-slate-700">Agregar fecha individual</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                    <input type="date" id="date-picker" value={dateToAdd} onChange={(e) => setDateToAdd(e.target.value)} className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md bg-white/40 border border-slate-300 text-slate-900 focus:ring-amber-500 focus:border-amber-500 sm:text-sm"/>
                    <button type="button" onClick={handleAddDate} className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-white/50 text-slate-700 text-sm hover:bg-white/70">Agregar</button>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700">Agregar período de fechas</label>
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="Desde" id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required={false} />
                    <InputField label="Hasta" id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required={false} />
                </div>
                <button type="button" onClick={handleAddPeriod} disabled={!startDate || !endDate} className="mt-2 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:from-amber-300 disabled:to-orange-300 disabled:cursor-not-allowed">Agregar Período</button>
            </div>
        </div>
        {formData.dates.length > 0 && (
            <div>
                 <h4 className="text-sm font-medium text-slate-800">Fechas seleccionadas:</h4>
                 <div className="mt-2 flex flex-wrap gap-2">
                    {formData.dates.map(date => (
                        <span key={date} className="inline-flex items-center py-1 px-2.5 rounded-full text-xs font-medium bg-white/60 text-slate-800">
                            {new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                            <button type="button" onClick={() => handleRemoveDate(date)} className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-slate-500 hover:bg-white/80 hover:text-slate-700 focus:outline-none focus:bg-amber-500 focus:text-white">
                                <span className="sr-only">Quitar fecha</span>
                                <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8"><path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" /></svg>
                            </button>
                        </span>
                    ))}
                </div>
            </div>
        )}
      </div>

      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Comentarios Adicionales (Opcional)</h3>
        <textarea id="additionalNotes" name="additionalNotes" rows={4} value={formData.additionalNotes || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm" placeholder="Agregue cualquier información adicional relevante."/>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isGenerating} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:from-amber-400 disabled:to-orange-400 disabled:cursor-not-allowed">
          {isGenerating ? 'Generando...' : 'Generar Vista Previa'}
        </button>
      </div>
    </form>
  );
};