
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
  employeeName: string;
  type: LogType;
  timestamp: number;
  location?: Location;
}

export interface DetailedEmployee {
  id: string;
  codigo: string;
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