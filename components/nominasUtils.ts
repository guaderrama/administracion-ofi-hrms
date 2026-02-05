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

// --- Vacaciones según Ley Federal del Trabajo (Reforma 2023) ---

export interface VacationInfo {
  yearsWorked: number;
  daysEntitled: number;
  eligible: boolean; // true si ya cumplió al menos 1 año
  nextAnniversary: string; // fecha del próximo aniversario
}

// Tabla de vacaciones LFT 2023
// Año 1: 12 días, Año 2: 14, Año 3: 16, Año 4: 18, Año 5: 20
// Años 6-10: 22, 11-15: 24, 16-20: 26, 21-25: 28, 26-30: 30, 31-35: 32
function getVacationDaysByYears(years: number): number {
  if (years < 1) return 0;
  if (years <= 5) return 10 + (years * 2); // 12, 14, 16, 18, 20
  if (years <= 10) return 22;
  if (years <= 15) return 24;
  if (years <= 20) return 26;
  if (years <= 25) return 28;
  if (years <= 30) return 30;
  return 32;
}

export function calculateVacation(fechaIngreso: string): VacationInfo {
  if (!fechaIngreso) {
    return { yearsWorked: 0, daysEntitled: 0, eligible: false, nextAnniversary: 'N/A' };
  }

  const today = new Date();
  const startDate = new Date(fechaIngreso + 'T00:00:00');

  // Calcular años completos trabajados
  let yearsWorked = today.getFullYear() - startDate.getFullYear();
  const monthDiff = today.getMonth() - startDate.getMonth();
  const dayDiff = today.getDate() - startDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    yearsWorked--;
  }

  if (yearsWorked < 0) yearsWorked = 0;

  const eligible = yearsWorked >= 1;
  const daysEntitled = getVacationDaysByYears(yearsWorked);

  // Calcular próximo aniversario
  const nextYear = eligible
    ? (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? today.getFullYear() : today.getFullYear() + 1)
    : startDate.getFullYear() + 1;
  const nextAnniversary = `${startDate.getDate()} de ${MESES[startDate.getMonth()]} ${nextYear}`;

  return { yearsWorked, daysEntitled, eligible, nextAnniversary };
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const [year, month, day] = dateStr.split('-');
  return `${parseInt(day, 10)}/${month}/${year}`;
}
