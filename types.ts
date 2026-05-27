
export enum PermissionType {
  FULL_DAYS = 'Días completos',
  LATE_ARRIVAL = 'Llegar tarde',
  EARLY_DEPARTURE = 'Salir temprano',
  PARTIAL_ABSENCE = 'Ausencia parcial durante la jornada',
}

export enum Reason {
  PERSONAL = 'Personal',
  HEALTH = 'Salud',
  APPOINTMENT = 'Trámite / Cita',
  OTHER = 'Otro',
}

export enum Compensation {
  WITH_PAY = 'Con goce de sueldo',
  WITHOUT_PAY = 'Sin goce de sueldo',
  VACATION = 'A cuenta de vacaciones',
  EXTRA_TIME = 'Reposición con tiempo de trabajo adicional',
}

export enum CompensationMethod {
  ARRIVE_EARLIER = 'Entrar más temprano',
  LEAVE_LATER = 'Salir más tarde',
}

export interface PermissionRequest {
  id: string;
  status: string;
  firstName: string;
  lastName: string;
  motherLastName: string;
  requestDate: string;
  permissionType: PermissionType;
  
  // For FULL_DAYS
  daysCount?: number;
  dates?: string[]; // YYYY-MM-DD format
  
  // For LATE_ARRIVAL, EARLY_DEPARTURE, PARTIAL_ABSENCE
  permissionDate?: string; // YYYY-MM-DD format

  // For LATE_ARRIVAL
  arrivalTime?: string;

  // For EARLY_DEPARTURE
  departureTime?: string;

  // For PARTIAL_ABSENCE
  absenceStartTime?: string;
  absenceEndTime?: string;
  
  reason: Reason;
  compensation: Compensation;

  // For EXTRA_TIME
  extraTimeDetails?: string; // This will be programmatically generated
  compensationMethod?: CompensationMethod;
  compensationStartDate?: string;
  compensationMinutesPerDay?: number;

  additionalNotes?: string;

  // Flujo de aprobacion en 2 pasos
  supervisorApproval?: {
    status: 'pendiente' | 'aprobado' | 'denegado';
    by?: string;       // email del supervisor
    byName?: string;   // nombre del supervisor
    date?: string;     // ISO date
    comment?: string;
  };
  adminApproval?: {
    status: 'pendiente' | 'aprobado' | 'denegado';
    by?: string;
    byName?: string;
    date?: string;
    comment?: string;
  };
}

export interface VacationRequest {
  firstName: string;
  lastName: string;
  motherLastName: string;
  requestDate: string;
  hireDate: string;
  vacationDaysEntitled: number;
  dates: string[];
  daysRequested: number;
  daysRemaining: number;
  additionalNotes?: string;
}

export interface LoanRequest {
  firstName: string;
  lastName: string;
  motherLastName: string;
  requestDate: string;
  loanAmount: number;
  installments: number; // in bi-weekly periods (quincenas)
}

// --- Préstamos ---

export type LoanStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'liquidado';

export interface LoanPayment {
  quincena: number; // 1, 2, 3...
  periodLabel: string; // "1ra Quincena Junio 2026"
  amount: number;
  date?: string; // YYYY-MM-DD cuando se aplicó
  applied: boolean; // si ya se descontó en nómina
}

export interface EmployeeLoan {
  id?: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  loanAmount: number;
  installments: number;
  biweeklyPayment: number; // monto quincenal por defecto
  remainingBalance: number;
  paidAmount: number;
  payments: LoanPayment[];
  status: LoanStatus;
  requestDate: string;
  approvedDate?: string;
  approvedBy?: string;
  rejectedDate?: string;
  rejectedBy?: string;
  notes?: string;
  createdBy: string;
  createdAt: any;
}

// --- Checador Types ---

export interface Location {
  lat: number;
  lon: number;
}

export enum LogType {
  ENTRADA = 'ENTRADA',
  INICIO_COMIDA = 'INICIO COMIDA',
  FIN_COMIDA = 'FIN COMIDA',
  SALIDA = 'SALIDA',
}

export enum ClockStatus {
  OUT_OF_OFFICE,
  WORKING,
  ON_LUNCH,
}

export enum IncidentType {
  LATE_ARRIVAL = 'Retardo',
  MISSED_LUNCH = 'Comida no registrada',
  NO_CHECK_OUT = 'Salida no registrada',
}

export interface Employee {
  name: string;
  pin: string;
  scheduleStartTime: string; // HH:mm format
  birthDate: string; // YYYY-MM-DD
  hireDate: string; // YYYY-MM-DD
}

export interface LogEntry {
  id?: string; // Firestore document ID for editing/deleting
  employeeName: string;
  employeeCode?: string; // Codigo del empleado para matching robusto
  createdByUid?: string; // UID del usuario que creó el registro
  type: LogType;
  timestamp: number;
  location?: Location;
}

export interface DetailedEmployee {
  id: string;
  codigo: string;
  email: string; // Email para login
  firebaseUid?: string; // UID de Firebase Auth
  paterno: string;
  materno: string;
  nombres: string;
  fechaIngreso: string; // YYYY-MM-DD
  fechaNacimiento: string; // YYYY-MM-DD
  curp: string;
  rfc: string;
  nss: string;
  departamento: string;
  puesto: string;
  horarioLunesMiercolesViernes: string;
  horarioJueves: string;
  horarioSabado: string;
  bonoPuntualidad: number;
  bonoObjetivos: number;
  apoyoGasolina: number;
  lastPasswordReset?: string; // ISO date string of last password reset
}

// --- Income Types ---

export enum PaymentConcept {
  NOMINA = 'Nómina',
  BONOS = 'Bonos',
  CAMINATA = 'Caminata',
  COMISIONES_SOUVENIRS = 'Comisiones Souvenirs',
  COMISIONES_OBRAS = 'Comisiones Obras',
  RETAIL = 'Retail',
}

export interface IncomeEntry {
  id: string;
  employeeName: string;
  paymentDate: string; // YYYY-MM-DD
  paymentConcept: PaymentConcept;
  amount: number;
  notes?: string;
}

// --- Comisiones ---

export type ProductCategory = 'joyeria' | 'souvenirs' | 'originales';
export type CommissionType = 'jueves' | 'semana';

export interface SaleRecord {
  receiptNum: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=domingo, 4=jueves
  customerCode: string;
  customerName: string;
  quantity: number;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  details: string;
  register: string;
  user: string; // vendedor
  status: string;
  sku: string;
  paymentMethod: string; // Credit Card MNX, Cash USD, etc.
  category: ProductCategory;
  isExcluded: boolean; // true si es venta a colaborador, cortesía o voided
  excludeReason?: string;
}

export interface SaleGroup {
  receiptNum: string;
  date: string;
  dayOfWeek: number;
  customerCode: string;
  customerName: string;
  user: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  status: string;
  lines: SaleRecord[];
  isExcluded: boolean;
  excludeReason?: string;
}

export interface CommissionSettings {
  ivaPercent: number; // default 16
  bankFeePercent: number; // default 4
  exchangeRate: number; // USD to MXN
  joyeriaPercentJueves: number; // default 5
  souvenirsPercentJueves: number; // default 25
  originalesPercentJueves: number; // editable
  joyeriaPercentSemana: number; // editable
  souvenirsPercentSemana: number; // editable
  originalesPercentSemana: number; // editable
}

export interface CommissionSummary {
  type: CommissionType;
  dateRange: { start: string; end: string };
  totalSales: number;
  excludedSales: number;
  joyeriaTotal: number;
  souvenirsTotal: number;
  originalesTotal: number;
  joyeriaCommission: number;
  souvenirsCommission: number;
  originalesCommission: number;
  totalCommission: number;
}

export interface EmployeeCommission {
  employeeCode: string;
  employeeName: string;
  present: boolean; // para jueves
  individualSales: number; // para semana (ventas propias)
  commission: number;
}

// --- Attendance Day (resumen validado de asistencia por día) ---

export type AttendanceDayStatus = 'complete' | 'incomplete' | 'no_checkout' | 'incomplete_lunch' | 'anomaly';

export interface AttendanceDay {
  id?: string; // formato: {employeeCode}__{YYYY-MM-DD}
  employeeCode: string;
  employeeName: string;
  date: string; // YYYY-MM-DD local
  status: AttendanceDayStatus;
  checkInTimestamp?: number;
  checkOutTimestamp?: number;
  lunchBreaks: { start: number; end: number }[];
  workedMinutes: number | null;
  isLate: boolean;
  lateMinutes: number;
  payableDay: boolean;
  validationErrors: string[];
  sourceLogIds: string[];
  computedAt: number;
}