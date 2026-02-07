import React, { useState, useMemo, useCallback } from 'react';
import type { LoanRequest } from '../types';
import { useToast } from './ui/Toast';

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
            className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent sm:text-sm read-only:bg-slate-100/50 read-only:cursor-not-allowed"
        />
    </div>
));

export const LoanRequestForm: React.FC<LoanRequestFormProps> = ({ onSubmit, isGenerating }) => {
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState<Omit<LoanRequest, 'loanAmount' | 'installments'> & { loanAmount: string; installments: string }>({
    firstName: '',
    lastName: '',
    motherLastName: '',
    requestDate: today,
    loanAmount: '',
    installments: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);

  const biweeklyPayment = useMemo(() => {
    const amount = parseFloat(formData.loanAmount);
    const inst = parseInt(formData.installments, 10);
    if (amount > 0 && inst > 0) {
      return (amount / inst).toFixed(2);
    }
    return '0.00';
  }, [formData.loanAmount, formData.installments]);

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
    onSubmit({
        ...formData,
        loanAmount: parseFloat(formData.loanAmount) || 0,
        installments: parseInt(formData.installments, 10) || 0,
    });
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
      </div>
      
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
            <InputField 
                label="Plazo de Pago (quincenas)" 
                id="installments" 
                type="number" 
                value={formData.installments} 
                onChange={handleChange}
                placeholder="Ej: 10"
                min={1}
            />
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-700">Descuento quincenal estimado</label>
            <div className="mt-1 p-3 bg-slate-100/50 rounded-md border border-slate-300/50 text-slate-800 text-center font-mono text-lg">
                ${biweeklyPayment} MXN
            </div>
        </div>
      </div>

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
        <button type="submit" disabled={isGenerating || !termsAccepted} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:from-amber-400 disabled:to-orange-400 disabled:cursor-not-allowed">
          {isGenerating ? 'Generando...' : 'Generar Vista Previa'}
        </button>
      </div>
    </form>
  );
};
