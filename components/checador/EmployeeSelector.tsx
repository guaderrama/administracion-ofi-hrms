import React from 'react';
import { EMPLOYEES } from '../../checadorConstants';
import { UserIcon } from './icons/UserIcon';
import type { Employee } from '../../types';

interface EmployeeSelectorProps {
  onSelect: (employeeName: string) => void;
  filteredEmployees?: Employee[]; // Lista filtrada de empleados (opcional)
}

export const EmployeeSelector: React.FC<EmployeeSelectorProps> = ({ onSelect, filteredEmployees }) => {
  // Usar la lista filtrada si se proporciona, sino usar EMPLOYEES completo
  const employeeList = filteredEmployees || EMPLOYEES;

  return (
    <div className="w-full">
      <label htmlFor="employee-select" className="block text-sm font-medium text-slate-700 text-center mb-2">
        {employeeList.length === 1
          ? 'Confirme su identidad para continuar'
          : 'Seleccione su nombre para continuar'
        }
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <UserIcon />
        </div>
        <select
          id="employee-select"
          onChange={(e) => onSelect(e.target.value)}
          defaultValue=""
          className="block w-full appearance-none rounded-md border border-slate-300 bg-white/40 py-3 pl-10 pr-10 text-base text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-amber-500 sm:text-sm"
        >
          <option value="" disabled>-- Por favor, seleccione --</option>
          {employeeList.map((employee) => (
            <option key={employee.name} value={employee.name}>
              {employee.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
