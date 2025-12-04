import React, { useState, useEffect, useCallback } from 'react';
import type { VacationRequest } from '../types';
import { calculateVacationDays } from '../utils/vacationCalculator';

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


export const VacationForm: React.FC<VacationFormProps> = ({ onSubmit, isGenerating }) => {
  const today = new Date().toISOString().split('T')[0];
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

  const [dateToAdd, setDateToAdd] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [excludeSaturdays, setExcludeSaturdays] = useState(false);

  useEffect(() => {
    const entitledDays = calculateVacationDays(formData.hireDate, formData.requestDate);
    const requestedDays = formData.dates.length;
    setFormData(prev => ({
      ...prev,
      vacationDaysEntitled: entitledDays,
      daysRequested: requestedDays,
      daysRemaining: entitledDays - requestedDays
    }));
  }, [formData.hireDate, formData.requestDate, formData.dates]);

  const updateDates = useCallback((newDates: string[]) => {
    setFormData(prev => ({
        ...prev,
        dates: newDates,
    }));
  }, []);

  const handleAddDate = useCallback(() => {
    if (dateToAdd && !formData.dates.includes(dateToAdd)) {
        const selectedDate = new Date(dateToAdd + 'T12:00:00');
        if (selectedDate.getDay() === 0) { // 0 is Sunday
          alert('El domingo es día de descanso y no puede ser seleccionado como día de vacaciones.');
          return;
        }
        if (excludeSaturdays && selectedDate.getDay() === 6) { // 6 is Saturday
          alert('El sábado ha sido marcado como día de descanso y no puede ser seleccionado.');
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
        alert('La fecha de inicio no puede ser posterior a la fecha de fin.');
        return;
    }

    const newDatesInRange = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      const isWeekendToExclude = dayOfWeek === 0 || (excludeSaturdays && dayOfWeek === 6);

      if (!isWeekendToExclude) {
        newDatesInRange.push(currentDate.toISOString().slice(0, 10));
      }
      currentDate.setDate(currentDate.getDate() + 1);
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
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(formData.daysRequested > formData.vacationDaysEntitled){
      alert('Error: Has seleccionado más días de los que te corresponden. Por favor, ajusta las fechas.');
      return;
    }
    onSubmit(formData);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Datos del Colaborador</h3>
        <InputField label="Fecha de Solicitud" id="requestDate" type="date" value={formData.requestDate} onChange={handleChange} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField label="Nombre(s)" id="firstName" value={formData.firstName} onChange={handleChange} />
            <InputField label="Apellido Paterno" id="lastName" value={formData.lastName} onChange={handleChange} />
            <InputField label="Apellido Materno" id="motherLastName" value={formData.motherLastName} onChange={handleChange} />
        </div>
        <InputField label="Fecha de Ingreso a la Empresa" id="hireDate" type="date" value={formData.hireDate} onChange={handleChange} />
      </div>
      
      <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-slate-800">Cálculo de Días de Vacaciones</h3>
        <div className="grid grid-cols-3 gap-4 p-4 bg-black/5 rounded-lg border border-slate-300/50">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Días Correspondientes</p>
            <p className="text-2xl font-bold text-amber-700">{formData.vacationDaysEntitled}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Días Solicitados</p>
            <p className="text-2xl font-bold text-slate-800">{formData.daysRequested}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Días Pendientes</p>
            <p className={`text-2xl font-bold ${formData.daysRemaining < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formData.daysRemaining}</p>
          </div>
        </div>
        {formData.daysRemaining < 0 && <p className="text-sm text-red-600 font-medium text-center">Advertencia: Estás solicitando más días de los que te corresponden.</p>}
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