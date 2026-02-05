import type { DetailedEmployee } from '../types';

export interface PayrollPeriod {
  year: number;
  month: number; // 0-11 (JavaScript month)
  quincena: 1 | 2; // 1 = days 1-15, 2 = days 16-lastDay
}

export interface SalaryBreakdown {
  bonoPuntualidad: number;
  bonoObjetivos: number;
  apoyoGasolina: number;
  totalPercepciones: number;
  totalDeducciones: number;
  netoAPagar: number;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function getCurrentPeriod(): PayrollPeriod {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    quincena: now.getDate() <= 15 ? 1 : 2,
  };
}

export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getPeriodLabel(period: PayrollPeriod): string {
  const lastDay = getLastDayOfMonth(period.year, period.month);
  const startDay = period.quincena === 1 ? 1 : 16;
  const endDay = period.quincena === 1 ? 15 : lastDay;
  return `${startDay} al ${endDay} de ${MESES[period.month]} ${period.year}`;
}

export function getMonthName(month: number): string {
  return MESES[month] || '';
}

export function calculateSalary(employee: DetailedEmployee): SalaryBreakdown {
  const bonoPuntualidad = employee.bonoPuntualidad || 0;
  const bonoObjetivos = employee.bonoObjetivos || 0;
  const apoyoGasolina = employee.apoyoGasolina || 0;
  const totalPercepciones = bonoPuntualidad + bonoObjetivos + apoyoGasolina;

  return {
    bonoPuntualidad,
    bonoObjetivos,
    apoyoGasolina,
    totalPercepciones,
    totalDeducciones: 0,
    netoAPagar: totalPercepciones,
  };
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

export function getEmployeeFullName(employee: DetailedEmployee): string {
  return `${employee.paterno} ${employee.materno} ${employee.nombres}`;
}
