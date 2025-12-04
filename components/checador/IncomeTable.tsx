import React from 'react';
import type { IncomeEntry } from '../../types';

interface IncomeTableProps {
  incomes: IncomeEntry[];
}

export const IncomeTable: React.FC<IncomeTableProps> = ({ incomes }) => {
  const sortedIncomes = [...incomes].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

  return (
    <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
      <h3 className="text-xl font-bold text-slate-800 mb-4">Historial de Ingresos</h3>
       <div className="overflow-x-auto max-h-96">
            <table className="min-w-full bg-white/60 rounded-lg shadow">
                <thead className="bg-white/80 sticky top-0">
                <tr>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Concepto</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Importe</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                {sortedIncomes.length > 0 ? sortedIncomes.map(income => (
                    <tr key={income.id} className="hover:bg-slate-100/50">
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{new Date(income.paymentDate + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-800">{income.paymentConcept}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-900 font-mono text-right">${income.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                )) : (
                    <tr>
                    <td colSpan={3} className="text-center py-4 text-sm text-slate-500">No hay ingresos registrados.</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    </div>
  );
};