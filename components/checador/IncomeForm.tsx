import React, { useState, useCallback } from 'react';
import type { IncomeEntry, PaymentConcept } from '../../types';
import { PAYMENT_CONCEPT_OPTIONS } from './incomeConstants';

interface IncomeFormProps {
  onSubmit: (data: Omit<IncomeEntry, 'id' | 'employeeName' | 'notes'>) => void;
}

export const IncomeForm: React.FC<IncomeFormProps> = ({ onSubmit }) => {
  const initialState = {
    paymentDate: new Date().toISOString().split('T')[0],
    paymentConcept: PAYMENT_CONCEPT_OPTIONS[0],
    amount: '',
  };
  
  const [formData, setFormData] = useState(initialState);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Por favor, ingrese un importe válido.');
      return;
    }
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      paymentConcept: formData.paymentConcept as PaymentConcept,
    });
    setFormData(initialState); // Reset form
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
      <h3 className="text-xl font-bold text-slate-800">Registrar Nuevo Ingreso</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="paymentDate" className="block text-sm font-medium text-slate-700">Fecha de Pago</label>
          <input type="date" name="paymentDate" id="paymentDate" value={formData.paymentDate} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
        </div>
        <div>
          <label htmlFor="paymentConcept" className="block text-sm font-medium text-slate-700">Concepto de Pago</label>
          <select name="paymentConcept" id="paymentConcept" value={formData.paymentConcept} onChange={handleChange} required className="mt-1 block w-full pl-3 pr-10 py-2 text-slate-900 bg-white/40 border border-slate-300 rounded-md shadow-sm">
            {PAYMENT_CONCEPT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-slate-700">Importe ($)</label>
        <input type="number" name="amount" id="amount" value={formData.amount} onChange={handleChange} required min="0.01" step="0.01" placeholder="0.00" className="mt-1 block w-full px-3 py-2 bg-white/40 border border-slate-300 rounded-md shadow-sm"/>
      </div>
      <div className="text-right">
        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
          Registrar Ingreso
        </button>
      </div>
    </form>
  );
};