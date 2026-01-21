import React from 'react';
import type { IncomeEntry } from '../../types';

interface IncomeTableProps {
  incomes: IncomeEntry[];
  onEditIncome?: (income: IncomeEntry) => void;
  onDeleteIncome?: (income: IncomeEntry) => void;
}

export const IncomeTable: React.FC<IncomeTableProps> = ({ incomes, onEditIncome, onDeleteIncome }) => {
  const sortedIncomes = [...incomes].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  const showActions = onEditIncome || onDeleteIncome;

  return (
    <div className="p-6 bg-white/30 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
      <h3 className="text-xl font-bold text-slate-800 mb-4">Historial de Ingresos </h3>
       <div className="overflow-x-auto max-h-96">
            <table className="min-w-full bg-white/60 rounded-lg shadow">
                <thead className="bg-white/80 sticky top-0">
                <tr>
                    {showActions && (
                      <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                    )}
                    <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Concepto</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Importe</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                {sortedIncomes.length > 0 ? sortedIncomes.map(income => (
                    <tr key={income.id} className="hover:bg-slate-100/50">
                    {showActions && (
                      <td className="py-3 px-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          {onEditIncome && (
                            <button
                              onClick={() => onEditIncome(income)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Editar ingreso"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {onDeleteIncome && (
                            <button
                              onClick={() => onDeleteIncome(income)}
                              className="text-red-600 hover:text-red-800"
                              title="Eliminar ingreso"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-700 font-mono">{new Date(income.paymentDate + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-800">{income.paymentConcept}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-sm text-slate-900 font-mono text-right">${income.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                )) : (
                    <tr>
                    <td colSpan={showActions ? 4 : 3} className="text-center py-4 text-sm text-slate-500">No hay ingresos registrados.</td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    </div>
  );
};
