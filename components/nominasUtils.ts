import type { DetailedEmployee } from '../types';

export interface PayrollPeriod {
  year: number;
  month: number; // 0-11 (JavaScript month)
  quincena: 1 | 2; // 1 = primera quincena, 2 = segunda quincena
  startDay: number; // día inicio del periodo (editable)
  endDay: number;   // día fin del periodo (editable)
}

export interface SalaryBreakdown {
  bonoPuntualidad: number;
  bonoObjetivos: number;
  apoyoGasolina: number;
  totalPercepciones: number;
  totalDeducciones: number;
  netoAPagar: number;
  diasTrabajados: number;
  diasEnPeriodo: number;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function getDefaultDays(quincena: 1 | 2, year: number, month: number): { startDay: number; endDay: number } {
  if (quincena === 1) return { startDay: 1, endDay: 15 };
  return { startDay: 16, endDay: getLastDayOfMonth(year, month) };
}

export function getCurrentPeriod(): PayrollPeriod {
  const now = new Date();
  const quincena: 1 | 2 = now.getDate() <= 15 ? 1 : 2;
  const days = getDefaultDays(quincena, now.getFullYear(), now.getMonth());
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    quincena,
    startDay: days.startDay,
    endDay: days.endDay,
  };
}

export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getPeriodLabel(period: PayrollPeriod): string {
  return `${period.startDay} al ${period.endDay} de ${MESES[period.month]} ${period.year}`;
}

export function getMonthName(month: number): string {
  return MESES[month] || '';
}

/** Días naturales en el periodo (endDay - startDay + 1) */
export function getDaysInQuincena(period: PayrollPeriod): number {
  return period.endDay - period.startDay + 1;
}

/**
 * Calcula salario proporcional por quincena.
 * Los bonos/apoyos son montos MENSUALES que se dividen entre 30 días,
 * y se pagan según los días trabajados en la quincena.
 */
export function calculateSalary(
  employee: DetailedEmployee,
  diasTrabajados: number,
  diasEnPeriodo: number,
): SalaryBreakdown {
  const monthlyBonoPuntualidad = employee.bonoPuntualidad || 0;
  const monthlyBonoObjetivos = employee.bonoObjetivos || 0;
  const monthlyApoyoGasolina = employee.apoyoGasolina || 0;

  // Tasa diaria = monto mensual / 30
  const factor = diasTrabajados / 30;

  const bonoPuntualidad = Math.round(monthlyBonoPuntualidad * factor * 100) / 100;
  const bonoObjetivos = Math.round(monthlyBonoObjetivos * factor * 100) / 100;
  const apoyoGasolina = Math.round(monthlyApoyoGasolina * factor * 100) / 100;
  const totalPercepciones = Math.round((bonoPuntualidad + bonoObjetivos + apoyoGasolina) * 100) / 100;

  return {
    bonoPuntualidad,
    bonoObjetivos,
    apoyoGasolina,
    totalPercepciones,
    totalDeducciones: 0,
    netoAPagar: totalPercepciones,
    diasTrabajados,
    diasEnPeriodo,
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
