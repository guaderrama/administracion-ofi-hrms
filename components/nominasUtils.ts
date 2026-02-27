import type { DetailedEmployee } from '../types';

export interface PayrollPeriod {
  quincena: 1 | 2;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
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

/** Formato YYYY-MM-DD a partir de año, mes (0-11), día */
function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getDefaultPeriod(quincena: 1 | 2, year: number, month: number): PayrollPeriod {
  if (quincena === 1) {
    return { quincena, startDate: toDateStr(year, month, 1), endDate: toDateStr(year, month, 15) };
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { quincena, startDate: toDateStr(year, month, 16), endDate: toDateStr(year, month, lastDay) };
}

export function getCurrentPeriod(): PayrollPeriod {
  const now = new Date();
  const quincena: 1 | 2 = now.getDate() <= 15 ? 1 : 2;
  return getDefaultPeriod(quincena, now.getFullYear(), now.getMonth());
}

export function getPeriodLabel(period: PayrollPeriod): string {
  const start = new Date(period.startDate + 'T00:00:00');
  const end = new Date(period.endDate + 'T00:00:00');
  const startStr = `${start.getDate()} de ${MESES[start.getMonth()]}`;
  const endStr = `${end.getDate()} de ${MESES[end.getMonth()]} ${end.getFullYear()}`;
  // Si mismo mes, simplificar
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} al ${end.getDate()} de ${MESES[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${startStr} al ${endStr}`;
}

export function getMonthName(month: number): string {
  return MESES[month] || '';
}

/** Días naturales en el periodo */
export function getDaysInQuincena(period: PayrollPeriod): number {
  const start = new Date(period.startDate + 'T00:00:00');
  const end = new Date(period.endDate + 'T00:00:00');
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
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
