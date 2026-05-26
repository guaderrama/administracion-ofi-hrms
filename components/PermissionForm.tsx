
import React, { useState, useCallback, useMemo } from 'react';
import type { PermissionRequest, DetailedEmployee } from '../types';
import { employeesService } from '../src/services/firestoreService';
import { PermissionType, Reason, Compensation, CompensationMethod } from '../types';
import { PERMISSION_TYPE_OPTIONS, REASON_OPTIONS, COMPENSATION_OPTIONS, COMPENSATION_METHOD_OPTIONS } from '../constants';
import { useToast } from './ui/Toast';

interface PermissionFormProps {
  onSubmit: (data: Omit<PermissionRequest, 'id' | 'status'>) => void;
  isGenerating: boolean;
}

// FIX: Correctly type the memoized InputField component.
const InputField: React.FC<{ label: string; id: string; type?: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean; readOnly?: boolean }> = React.memo(({ label, id, type = 'text', value, onChange, required = true, readOnly = false }) => (
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
    </div>
));

// FIX: Correctly type the memoized SelectField component.
const SelectField: React.FC<{ label: string; id: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: string[] }> = React.memo(({ label, id, value, onChange, options }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
        <select
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            required
            className="mt-1 block w-full pl-3 pr-10 py-2 text-slate-900 bg-white/40 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm rounded-md"
        >
            <option value="" disabled>Seleccione una opción</option>
            {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
    </div>
));


// Parsear horario "HH:MM-HH:MM" a minutos de trabajo (restando 1h de comida si >= 7h)
function parseScheduleToWorkMinutes(schedule: string | undefined): number | null {
  if (!schedule || schedule.toLowerCase().includes('no labora')) return 0;
  const parts = schedule.split('-').map(s => s.trim());
  if (parts.length < 2) return null;
  const [sh, sm] = parts[0].split(':').map(Number);
  const [eh, em] = parts[1].split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
  let totalMin = (eh * 60 + em) - (sh * 60 + sm);
  // Si trabaja 7+ horas, restar 1h de comida
  if (totalMin >= 420) totalMin -= 60;
  return Math.max(totalMin, 0);
}

// Obtener horario y hora de entrada/salida del empleado para un dia especifico
function getScheduleForDate(emp: DetailedEmployee, dateStr: string): { schedule: string; startMin: number; endMin: number; workMin: number } {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=dom, 1=lun...6=sab

  let schedule = emp.horarioLunesMiercolesViernes || '09:00-18:00';
  if (day === 4) schedule = emp.horarioJueves || schedule; // jueves
  if (day === 6) schedule = emp.horarioSabado || schedule; // sabado
  if (day === 0) return { schedule: 'No labora', startMin: 0, endMin: 0, workMin: 0 }; // domingo

  if (schedule.toLowerCase().includes('no labora')) {
    return { schedule, startMin: 0, endMin: 0, workMin: 0 };
  }

  const parts = schedule.split('-').map(s => s.trim());
  const [sh, sm] = (parts[0] || '09:00').split(':').map(Number);
  const [eh, em] = (parts[1] || '18:00').split(':').map(Number);
  const startMin = (sh || 9) * 60 + (sm || 0);
  const endMin = (eh || 18) * 60 + (em || 0);
  let workMin = endMin - startMin;
  if (workMin >= 420) workMin -= 60; // restar comida
  return { schedule, startMin, endMin, workMin: Math.max(workMin, 0) };
}

export const PermissionForm: React.FC<PermissionFormProps> = ({ onSubmit, isGenerating }) => {
  const toast = useToast();
  const [employeeCode, setEmployeeCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [employeeFound, setEmployeeFound] = useState(false);
  const [foundEmployee, setFoundEmployee] = useState<DetailedEmployee | null>(null);

  const [formData, setFormData] = useState<Omit<PermissionRequest, 'id' | 'status'>>({
    firstName: '',
    lastName: '',
    motherLastName: '',
    requestDate: new Date().toISOString().split('T')[0],
    permissionType: PermissionType.FULL_DAYS,
    reason: Reason.PERSONAL,
    compensation: Compensation.WITHOUT_PAY,
    daysCount: 0,
    dates: [],
    permissionDate: '',
    arrivalTime: '',
    departureTime: '',
    absenceStartTime: '',
    absenceEndTime: '',
    extraTimeDetails: '',
    additionalNotes: '',
    compensationMethod: CompensationMethod.LEAVE_LATER,
    compensationStartDate: '',
    compensationMinutesPerDay: 60,
  });

  // Función para buscar empleado por código
  const handleCodeSearch = useCallback(async (code: string) => {
    setEmployeeCode(code);
    setCodeError('');
    setEmployeeFound(false);

    if (code.length < 6) {
      // Limpiar datos si el código es muy corto
      if (code.length === 0) {
        setFormData(prev => ({
          ...prev,
          firstName: '',
          lastName: '',
          motherLastName: '',
        }));
      }
      return;
    }

    // Buscar en Firestore
    let detailedEmployees: DetailedEmployee[] = [];
    try {
      detailedEmployees = await employeesService.getAll();
    } catch {
      setCodeError('Error al leer datos de empleados. Recarga la página.');
      return;
    }

    if (detailedEmployees.length === 0) {
      setCodeError('No hay empleados registrados en el sistema.');
      return;
    }

    const foundEmp = detailedEmployees.find(emp => emp.codigo === code);

    if (foundEmp) {
      setFormData(prev => ({
        ...prev,
        firstName: foundEmp.nombres,
        lastName: foundEmp.paterno,
        motherLastName: foundEmp.materno,
      }));
      setEmployeeFound(true);
      setFoundEmployee(foundEmp);
      setCodeError('');
    } else {
      setCodeError('Código no encontrado. Verifica e intenta de nuevo.');
      setFoundEmployee(null);
      setFormData(prev => ({
        ...prev,
        firstName: '',
        lastName: '',
        motherLastName: '',
      }));
    }
  }, []);

  const [dateToAdd, setDateToAdd] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const updateDates = useCallback((newDates: string[]) => {
    setFormData(prev => ({
        ...prev,
        dates: newDates,
        daysCount: newDates.length,
    }));
  }, []);

  const handleAddDate = useCallback(() => {
    const currentDates = formData.dates || [];
    if (dateToAdd && !currentDates.includes(dateToAdd)) {
        const newDates = [...currentDates, dateToAdd].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        updateDates(newDates);
        setDateToAdd('');
    }
  }, [dateToAdd, formData.dates, updateDates]);
  
  const handleAddPeriod = useCallback(() => {
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      toast.warning('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    const newDatesInRange = [];
    const currentDate = new Date(start);
    
    currentDate.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);

    while (currentDate <= end) {
      newDatesInRange.push(currentDate.toISOString().slice(0, 10));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const allDates = [...new Set([...(formData.dates || []), ...newDatesInRange])].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    updateDates(allDates);
    setStartDate('');
    setEndDate('');
  }, [startDate, endDate, formData.dates, updateDates]);

  const handleRemoveDate = useCallback((dateToRemove: string) => {
    const currentDates = formData.dates || [];
    const newDates = currentDates.filter(d => d !== dateToRemove);
    updateDates(newDates);
  }, [formData.dates, updateDates]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  const handlePermissionTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as PermissionType;
    setFormData(prev => {
      const newState = { ...prev, permissionType: value };
      if (value === PermissionType.FULL_DAYS) {
        newState.permissionDate = '';
      } else {
        newState.dates = [];
        newState.daysCount = 0;
      }
      return newState;
    });
  }, []);

  const timeToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
  };

  const totalMinutesToCompensate = useMemo(() => {
    const { permissionType, arrivalTime, departureTime, absenceStartTime, absenceEndTime, dates, permissionDate } = formData;

    // Fallback si no hay empleado encontrado
    const defaultStart = 9 * 60;
    const defaultEnd = 18 * 60;
    const defaultWork = 8 * 60;

    switch (permissionType) {
        case PermissionType.FULL_DAYS: {
            if (foundEmployee && dates && dates.length > 0) {
                // Calcular horas reales por cada dia seleccionado
                let totalMin = 0;
                dates.forEach(dateStr => {
                    const sched = getScheduleForDate(foundEmployee, dateStr);
                    totalMin += sched.workMin;
                });
                return totalMin;
            }
            // Fallback: usar dias x 8h
            return (dates?.length || 0) * defaultWork;
        }
        case PermissionType.LATE_ARRIVAL: {
            const arrival = timeToMinutes(arrivalTime);
            const dateForCalc = permissionDate || formData.requestDate;
            const startMin = foundEmployee && dateForCalc ? getScheduleForDate(foundEmployee, dateForCalc).startMin : defaultStart;
            return arrival > startMin ? arrival - startMin : 0;
        }
        case PermissionType.EARLY_DEPARTURE: {
            const departure = timeToMinutes(departureTime);
            const dateForCalc = permissionDate || formData.requestDate;
            const endMin = foundEmployee && dateForCalc ? getScheduleForDate(foundEmployee, dateForCalc).endMin : defaultEnd;
            return departure < endMin ? endMin - departure : 0;
        }
        case PermissionType.PARTIAL_ABSENCE: {
            const start = timeToMinutes(absenceStartTime);
            const end = timeToMinutes(absenceEndTime);
            return end > start ? end - start : 0;
        }
        default:
            return 0;
    }
  }, [formData.permissionType, formData.dates, formData.permissionDate, formData.arrivalTime, formData.departureTime, formData.absenceStartTime, formData.absenceEndTime, formData.requestDate, foundEmployee]);

  const formatMinutes = (minutes: number) => {
    if (minutes <= 0) return '0 minutos';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const parts = [];
    if (h > 0) parts.push(`${h} hora${h > 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} minuto${m > 1 ? 's' : ''}`);
    return parts.join(' y ');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let submissionData = { ...formData };

    if (formData.compensation === Compensation.EXTRA_TIME) {
        const minutesPerDay = formData.compensationMinutesPerDay || 0;
        const totalDays = minutesPerDay > 0 ? Math.ceil(totalMinutesToCompensate / minutesPerDay) : 0;

        const compensationText = 
            `Se repondrá el tiempo ${formData.compensationMethod === CompensationMethod.ARRIVE_EARLIER ? 'entrando' : 'saliendo'} ${minutesPerDay} minutos más ${formData.compensationMethod === CompensationMethod.ARRIVE_EARLIER ? 'temprano' : 'tarde'} cada día, ` +
            `comenzando el ${new Date(formData.compensationStartDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}. ` +
            `Total a reponer: ${formatMinutes(totalMinutesToCompensate)}. ` +
            `Esto tomará aproximadamente ${totalDays} día(s) de trabajo.`;
        
        submissionData = {
            ...submissionData,
            extraTimeDetails: compensationText,
        };
    }
    onSubmit(submissionData);
  };
  
  const renderPermissionDetails = () => {
    switch(formData.permissionType) {
        case PermissionType.FULL_DAYS:
            return (
                <>
                    <InputField label="Cantidad de días" id="daysCount" type="number" value={formData.daysCount || 0} onChange={() => {}} readOnly />
                    
                    <div className="mt-4 p-4 bg-black/5 border border-slate-300/50 rounded-lg space-y-4">
                        <h4 className="text-md font-medium text-slate-800">Seleccionar Fechas</h4>
                        
                        {/* Single Date */}
                        <div>
                            <label htmlFor="date-picker" className="block text-sm font-medium text-slate-700">Agregar fecha individual</label>
                            <div className="mt-1 flex rounded-md shadow-sm">
                                <input
                                    type="date"
                                    id="date-picker"
                                    value={dateToAdd}
                                    onChange={(e) => setDateToAdd(e.target.value)}
                                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md bg-white/40 border border-slate-300 text-slate-900 focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddDate}
                                    className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-white/50 text-slate-700 text-sm hover:bg-white/70"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>

                        {/* Date Range */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Agregar período de fechas</label>
                            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField label="Desde" id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required={false} />
                                <InputField label="Hasta" id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required={false} />
                            </div>
                            <button
                                type="button"
                                onClick={handleAddPeriod}
                                disabled={!startDate || !endDate}
                                className="mt-2 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:from-amber-300 disabled:to-orange-300 disabled:cursor-not-allowed"
                            >
                                Agregar Período
                            </button>
                        </div>
                    </div>
                    
                    {formData.dates && formData.dates.length > 0 && (
                        <div className="mt-4">
                             <h4 className="text-sm font-medium text-slate-800">Fechas seleccionadas:</h4>
                             <div className="mt-2 flex flex-wrap gap-2">
                                {formData.dates.map(date => (
                                    <span key={date} className="inline-flex items-center py-1 px-2.5 rounded-full text-xs font-medium bg-white/60 text-slate-800">
                                        {new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDate(date)}
                                            className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-slate-500 hover:bg-white/80 hover:text-slate-700 focus:outline-none focus:bg-amber-500 focus:text-white"
                                        >
                                            <span className="sr-only">Quitar fecha</span>
                                            <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                                                <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                                            </svg>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            );
        case PermissionType.LATE_ARRIVAL:
            return (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="Fecha del permiso" id="permissionDate" type="date" value={formData.permissionDate || ''} onChange={handleChange} />
                    <InputField label="Hora de llegada" id="arrivalTime" type="time" value={formData.arrivalTime || ''} onChange={handleChange} />
                </div>
            );
        case PermissionType.EARLY_DEPARTURE:
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="Fecha del permiso" id="permissionDate" type="date" value={formData.permissionDate || ''} onChange={handleChange} />
                    <InputField label="Hora de salida" id="departureTime" type="time" value={formData.departureTime || ''} onChange={handleChange} />
                </div>
            );
        case PermissionType.PARTIAL_ABSENCE:
            return (
                <div className="space-y-4">
                    <InputField label="Fecha del permiso" id="permissionDate" type="date" value={formData.permissionDate || ''} onChange={handleChange} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField label="Desde (hora)" id="absenceStartTime" type="time" value={formData.absenceStartTime || ''} onChange={handleChange} />
                        <InputField label="Hasta (hora)" id="absenceEndTime" type="time" value={formData.absenceEndTime || ''} onChange={handleChange} />
                    </div>
                </div>
            );
        default:
            return null;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Datos del Colaborador</h3>

        {/* Campo de código para búsqueda automática */}
        <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg">
          <label htmlFor="employeeCode" className="block text-sm font-medium text-amber-800 mb-1">
            Código de Empleado (6 dígitos)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="employeeCode"
              value={employeeCode}
              onChange={(e) => handleCodeSearch(e.target.value.replace(/[^0-9-]/g, ''))}
              maxLength={8}
              placeholder="Ej: 150590"
              className={`flex-1 px-3 py-2 bg-white border rounded-md shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm ${
                codeError ? 'border-red-300' : employeeFound ? 'border-green-300' : 'border-amber-300'
              }`}
            />
            {employeeFound && (
              <span className="inline-flex items-center px-3 py-2 rounded-md bg-green-100 text-green-800 text-sm font-medium">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Encontrado
              </span>
            )}
          </div>
          {codeError && (
            <p className="mt-1 text-sm text-red-600">{codeError}</p>
          )}
          <p className="mt-1 text-xs text-amber-600">
            Ingresa tu código de 6 dígitos para autocompletar tus datos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField label="Nombre(s)" id="firstName" value={formData.firstName} onChange={handleChange} readOnly={employeeFound} />
            <InputField label="Apellido Paterno" id="lastName" value={formData.lastName} onChange={handleChange} readOnly={employeeFound} />
            <InputField label="Apellido Materno" id="motherLastName" value={formData.motherLastName} onChange={handleChange} readOnly={employeeFound} />
        </div>
      </div>
      
      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Detalles del Permiso</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Fecha de Solicitud" id="requestDate" type="date" value={formData.requestDate} onChange={handleChange} readOnly />
            <SelectField label="Tipo de Permiso" id="permissionType" value={formData.permissionType} onChange={handlePermissionTypeChange} options={PERMISSION_TYPE_OPTIONS} />
        </div>
        {renderPermissionDetails()}
        <SelectField label="Motivo del Permiso" id="reason" value={formData.reason} onChange={handleChange} options={REASON_OPTIONS} />
      </div>

      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Forma de Compensación</h3>
        <SelectField label="Método de descuento/pago" id="compensation" value={formData.compensation} onChange={handleChange} options={COMPENSATION_OPTIONS} />
        {formData.compensation === Compensation.EXTRA_TIME && (
            <div className="p-4 bg-black/5 border border-slate-300/50 rounded-lg space-y-4">
                <div className="p-3 bg-amber-100/60 rounded-lg text-center">
                    <p className="text-sm font-medium text-amber-900">Total de tiempo a reponer</p>
                    <p className="text-xl font-bold text-amber-800">{formatMinutes(totalMinutesToCompensate)}</p>
                </div>
                {/* Desglose por dia segun horario del empleado */}
                {foundEmployee && formData.permissionType === PermissionType.FULL_DAYS && formData.dates && formData.dates.length > 0 && (
                    <div className="p-3 bg-blue-50/60 rounded-lg">
                        <p className="text-xs font-semibold text-blue-800 mb-1.5">Desglose segun tu horario registrado:</p>
                        <div className="space-y-1">
                            {formData.dates.map(dateStr => {
                                const sched = getScheduleForDate(foundEmployee, dateStr);
                                const dayName = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
                                return (
                                    <div key={dateStr} className="flex justify-between items-center text-xs">
                                        <span className="text-slate-700 capitalize">{dayName}</span>
                                        <span className="font-mono">
                                            {sched.workMin > 0 ? (
                                                <span className="text-blue-800 font-semibold">{sched.schedule} = {formatMinutes(sched.workMin)}</span>
                                            ) : (
                                                <span className="text-slate-400">No labora</span>
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SelectField 
                        label="Método de Reposición" 
                        id="compensationMethod" 
                        value={formData.compensationMethod || ''} 
                        onChange={handleChange} 
                        options={COMPENSATION_METHOD_OPTIONS} 
                    />
                    <InputField
                        label="Minutos a reponer por día"
                        id="compensationMinutesPerDay"
                        type="number"
                        value={formData.compensationMinutesPerDay || ''}
                        onChange={handleChange}
                    />
                </div>
                <InputField
                    label="Fecha de inicio de reposición"
                    id="compensationStartDate"
                    type="date"
                    value={formData.compensationStartDate || ''}
                    onChange={handleChange}
                    required={formData.compensation === Compensation.EXTRA_TIME}
                />
                 {(totalMinutesToCompensate > 0 && formData.compensationMinutesPerDay && formData.compensationMinutesPerDay > 0) && (
                    <div className="text-center text-sm text-slate-600 pt-2">
                        <p>
                            Se necesitarán aproximadamente <strong>{Math.ceil(totalMinutesToCompensate / formData.compensationMinutesPerDay)} día(s)</strong> para completar la reposición.
                        </p>
                    </div>
                )}
            </div>
        )}
        <p className="text-xs text-slate-500">La forma de compensación está sujeta a aprobación por la Dirección General.</p>
      </div>

      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Notas Adicionales (Opcional)</h3>
        <div>
            <label htmlFor="additionalNotes" className="sr-only">Notas Adicionales</label>
            <textarea
                id="additionalNotes"
                name="additionalNotes"
                rows={4}
                value={formData.additionalNotes || ''}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm"
                placeholder="Agregue cualquier información adicional relevante para su solicitud."
            />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isGenerating}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:from-amber-400 disabled:to-orange-400 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generando...' : 'Generar Vista Previa'}
        </button>
      </div>
    </form>
  );
};