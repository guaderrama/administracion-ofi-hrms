// Firestore Service - Persistencia de datos en la nube
// Este servicio reemplaza localStorage por Firestore para que los datos
// sean accesibles desde cualquier dispositivo/navegador

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import type { DetailedEmployee, LogEntry, PermissionRequest, IncomeEntry, AttendanceDay, AttendanceDayStatus } from '../../types';
import { LogType } from '../../types';
import { toLocalDateKey } from '../../utils/dateUtils';

/** Normaliza timestamps de Firestore (Timestamp object) o numéricos (epoch ms) a number */
function normalizeTimestamp(ts: any): number {
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  return Date.now();
}

// ============================================
// EMPLEADOS (detailed_employees)
// ============================================

const EMPLOYEES_COLLECTION = 'detailed_employees';

export const employeesService = {
  // Obtener todos los empleados
  async getAll(): Promise<DetailedEmployee[]> {
    const querySnapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as DetailedEmployee[];
  },

  // Obtener empleado por ID
  async getById(id: string): Promise<DetailedEmployee | null> {
    try {
      const docRef = doc(db, EMPLOYEES_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as DetailedEmployee;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener empleado:', error);
      return null;
    }
  },

  // Crear nuevo empleado
  async create(employee: Omit<DetailedEmployee, 'id'>): Promise<DetailedEmployee> {
    try {
      const docRef = await addDoc(collection(db, EMPLOYEES_COLLECTION), {
        ...employee,
        createdAt: Timestamp.now(),
      });
      return { ...employee, id: docRef.id };
    } catch (error) {
      console.error('Error al crear empleado:', error);
      throw error;
    }
  },

  // Actualizar empleado
  async update(id: string, data: Partial<DetailedEmployee>): Promise<void> {
    try {
      const docRef = doc(db, EMPLOYEES_COLLECTION, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al actualizar empleado:', error);
      throw error;
    }
  },

  // Eliminar empleado
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));
    } catch (error) {
      console.error('Error al eliminar empleado:', error);
      throw error;
    }
  },

  // Suscribirse a cambios en tiempo real
  subscribe(callback: (employees: DetailedEmployee[]) => void): () => void {
    const unsubscribe = onSnapshot(
      collection(db, EMPLOYEES_COLLECTION),
      (snapshot) => {
        const employees = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        })) as DetailedEmployee[];

        callback(employees);
      },
      (error) => {
        console.error('Error en suscripción de empleados:', error);
      }
    );
    return unsubscribe;
  },

};

// ============================================
// REGISTROS DE ASISTENCIA (attendance_logs)
// ============================================

const LOGS_COLLECTION = 'attendance_logs';

export const logsService = {
  // Obtener todos los logs
  async getAll(): Promise<LogEntry[]> {
    const querySnapshot = await getDocs(
      query(collection(db, LOGS_COLLECTION), orderBy('timestamp', 'desc'))
    );
    return querySnapshot.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: normalizeTimestamp(d.data().timestamp),
    })) as LogEntry[];
  },

  // Obtener logs por rango de fechas
  async getByDateRange(startDate: Date, endDate: Date): Promise<LogEntry[]> {
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      // timestamp se guarda como epoch ms (número) para compatibilidad con datos históricos
      const querySnapshot = await getDocs(
        query(
          collection(db, LOGS_COLLECTION),
          where('timestamp', '>=', start.getTime()),
          where('timestamp', '<=', end.getTime()),
          orderBy('timestamp', 'desc')
        )
      );
      return querySnapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: normalizeTimestamp(d.data().timestamp),
      })) as LogEntry[];
    } catch (error) {
      console.error('Error al obtener logs por fecha:', error);
      return [];
    }
  },

  // Obtener logs de un empleado para una fecha específica (hoy por defecto)
  async getByEmployeeAndDate(employeeName: string, date?: Date): Promise<LogEntry[]> {
    try {
      const targetDate = date || new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Intentar query con filtro de timestamp en servidor (requiere indice compuesto)
      let querySnapshot;
      try {
        querySnapshot = await getDocs(
          query(
            collection(db, LOGS_COLLECTION),
            where('employeeName', '==', employeeName),
            where('timestamp', '>=', startOfDay.getTime()),
            where('timestamp', '<=', endOfDay.getTime()),
            orderBy('timestamp', 'asc')
          )
        );
      } catch {
        // Fallback si no hay indice compuesto: filtrar en cliente
        const allSnapshot = await getDocs(
          query(
            collection(db, LOGS_COLLECTION),
            where('employeeName', '==', employeeName)
          )
        );
        const allLogs = allSnapshot.docs.map(d => ({
          ...d.data(),
          id: d.id,
          timestamp: normalizeTimestamp(d.data().timestamp),
        })) as LogEntry[];
        return allLogs
          .filter(log => log.timestamp >= startOfDay.getTime() && log.timestamp <= endOfDay.getTime())
          .sort((a, b) => a.timestamp - b.timestamp);
      }

      const filteredLogs = querySnapshot.docs
        .map(d => ({
          ...d.data(),
          id: d.id,
          timestamp: normalizeTimestamp(d.data().timestamp),
        })) as LogEntry[];

      return filteredLogs;
    } catch (error: unknown) {
      console.error('Error al obtener logs por empleado y fecha:', error);
      return [];
    }
  },

  // Crear nuevo log
  // timestamp: epoch ms (número) para queries compatibles con datos históricos
  // serverTime: serverTimestamp() como auditoría anti-fraude (no se usa en queries)
  async create(log: LogEntry): Promise<LogEntry> {
    try {
      const isAdminEdit = typeof log.timestamp === 'number' && log.timestamp > 0;
      const now = Timestamp.now().toMillis(); // Más cercano al servidor que Date.now()
      const docRef = await addDoc(collection(db, LOGS_COLLECTION), {
        ...log,
        timestamp: isAdminEdit ? log.timestamp : now,
        serverTime: serverTimestamp(), // Auditoría: hora real del servidor
        createdByUid: auth.currentUser?.uid || '',
        createdAt: serverTimestamp(),
      });
      return { ...log, id: docRef.id, timestamp: isAdminEdit ? log.timestamp : now };
    } catch (error) {
      console.error('Error al crear log:', error);
      throw error;
    }
  },

  // Crear log con validación atómica de secuencia (anti race condition)
  // Si la transacción falla, cae a create() normal como fallback
  async createWithValidation(log: LogEntry): Promise<LogEntry> {
    const VALID_TRANSITIONS: Record<string, LogType[]> = {
      'none': [LogType.ENTRADA],
      [LogType.ENTRADA]: [LogType.INICIO_COMIDA, LogType.SALIDA],
      [LogType.INICIO_COMIDA]: [LogType.FIN_COMIDA],
      [LogType.FIN_COMIDA]: [LogType.INICIO_COMIDA, LogType.SALIDA],
      [LogType.SALIDA]: [LogType.ENTRADA],
    };

    const statusDocId = (log.employeeCode || log.employeeName || 'unknown').replace(/\//g, '_');
    const statusRef = doc(db, 'employee_clock_status', statusDocId);

    let result: LogEntry;
    try {
      result = await runTransaction(db, async (transaction) => {
        // 1. Leer estado actual del empleado (atómico)
        const statusDoc = await transaction.get(statusRef);
        const currentStatus = statusDoc.exists() ? statusDoc.data() : { lastLogType: 'none' };
        const lastType = currentStatus.lastLogType || 'none';

        // Si es un nuevo día, resetear a 'none' (permitir nueva ENTRADA)
        const today = toLocalDateKey(Date.now());
        const lastDate = currentStatus.lastLogDate || '';
        const effectiveLastType = (lastDate === today) ? lastType : 'none';

        // 2. Validar transición
        const allowedNext = VALID_TRANSITIONS[effectiveLastType] || [LogType.ENTRADA];
        if (!allowedNext.includes(log.type)) {
          throw new Error(`Transición inválida: "${effectiveLastType}" → "${log.type}". Recarga la página.`);
        }

        // 3. Crear el log
        const now = Timestamp.now().toMillis();
        const newDocRef = doc(collection(db, LOGS_COLLECTION));
        transaction.set(newDocRef, {
          ...log,
          timestamp: now,
          serverTime: serverTimestamp(),
          createdByUid: auth.currentUser?.uid || '',
          createdAt: serverTimestamp(),
        });

        // 4. Actualizar estado del empleado
        transaction.set(statusRef, {
          lastLogType: log.type,
          lastLogDate: today,
          lastLogTimestamp: serverTimestamp(),
          employeeName: log.employeeName,
          employeeCode: log.employeeCode || '',
          updatedByUid: auth.currentUser?.uid || '',
        });

        return { ...log, id: newDocRef.id, timestamp: now };
      });
    } catch (txError: any) {
      // Si es error de transición, re-lanzar para mostrar al usuario
      if (txError.message?.includes('Transición inválida')) throw txError;

      // Fallback: crear log sin transacción (mejor registrar que perder la checada)
      console.warn('Transacción falló, usando fallback:', txError.message);
      result = await this.create(log);
    }

    // Recomputar AttendanceDay (no bloquea la respuesta)
    try {
      const today = toLocalDateKey(Date.now());
      const dayLogs = await logsService.getByEmployeeAndDate(log.employeeName);
      await attendanceDaysService.computeAndSave(
        log.employeeCode || '',
        log.employeeName,
        today,
        dayLogs,
      );
    } catch (err) {
      console.error('Error recomputando AttendanceDay:', err);
    }

    return result;
  },

  // Actualizar log existente (para correcciones del admin)
  async update(logId: string, data: Partial<LogEntry>): Promise<void> {
    try {
      const docRef = doc(db, LOGS_COLLECTION, logId);

      // Leer estado ANTES de actualizar para recomputar día original
      const beforeDoc = await getDoc(docRef);
      const beforeData = beforeDoc.exists() ? beforeDoc.data() : null;

      const { id, ...updateData } = data as LogEntry;
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
      });

      // Recomputar día NUEVO (después del update)
      await this._recomputeAttendanceDayForLog(logId);

      // Si la fecha o empleado cambió, recomputar también el día ANTERIOR
      if (beforeData) {
        const oldTs = normalizeTimestamp(beforeData.timestamp);
        const newTs = data.timestamp ? normalizeTimestamp(data.timestamp) : oldTs;
        const oldDate = toLocalDateKey(oldTs);
        const newDate = toLocalDateKey(newTs);
        const oldEmployee = beforeData.employeeName;
        const newEmployee = data.employeeName || oldEmployee;

        if (oldDate !== newDate || oldEmployee !== newEmployee) {
          // Recomputar el día original (que perdió este log)
          const oldDayLogs = await logsService.getByEmployeeAndDate(oldEmployee, new Date(oldTs));
          await attendanceDaysService.computeAndSave(
            beforeData.employeeCode || '',
            oldEmployee,
            oldDate,
            oldDayLogs,
          );
        }
      }
    } catch (error) {
      console.error('Error al actualizar log:', error);
      throw error;
    }
  },

  // Eliminar log (para correcciones del admin)
  async delete(logId: string): Promise<void> {
    try {
      // Leer el log antes de eliminar para saber qué día recomputar
      const logDoc = await getDoc(doc(db, LOGS_COLLECTION, logId));
      const logData = logDoc.exists() ? logDoc.data() : null;

      await deleteDoc(doc(db, LOGS_COLLECTION, logId));

      // Recomputar AttendanceDay si teníamos info del log
      if (logData) {
        const ts = normalizeTimestamp(logData.timestamp);
        const date = toLocalDateKey(ts);
        const dayLogs = await logsService.getByEmployeeAndDate(logData.employeeName, new Date(ts));
        await attendanceDaysService.computeAndSave(
          logData.employeeCode || '',
          logData.employeeName,
          date,
          dayLogs,
        );
      }
    } catch (error) {
      console.error('Error al eliminar log:', error);
      throw error;
    }
  },

  // Helper: recomputa AttendanceDay después de editar un log
  async _recomputeAttendanceDayForLog(logId: string): Promise<void> {
    try {
      const logDoc = await getDoc(doc(db, LOGS_COLLECTION, logId));
      if (!logDoc.exists()) return;
      const logData = logDoc.data();
      const ts = normalizeTimestamp(logData.timestamp);
      const date = toLocalDateKey(ts);
      const dayLogs = await logsService.getByEmployeeAndDate(logData.employeeName, new Date(ts));
      await attendanceDaysService.computeAndSave(
        logData.employeeCode || '',
        logData.employeeName,
        date,
        dayLogs,
      );
    } catch (err) {
      console.error('Error recomputando AttendanceDay tras edición:', err);
    }
  },

  // Suscribirse a cambios en tiempo real
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    const unsubscribe = onSnapshot(
      query(collection(db, LOGS_COLLECTION), orderBy('timestamp', 'desc')),
      (snapshot) => {
        const logs = snapshot.docs.map(d => ({
          ...d.data(),
          id: d.id,
          timestamp: normalizeTimestamp(d.data().timestamp),
        })) as LogEntry[];
        callback(logs);
      },
      (error) => {
        console.error('Error en suscripción de logs:', error);
      }
    );
    return unsubscribe;
  },

};

// ============================================
// SOLICITUDES DE PERMISO (permission_requests)
// ============================================

const PERMISSIONS_COLLECTION = 'permission_requests';

export const permissionsService = {
  // Obtener todas las solicitudes
  async getAll(): Promise<PermissionRequest[]> {
    const querySnapshot = await getDocs(collection(db, PERMISSIONS_COLLECTION));
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as PermissionRequest[];
  },

  // Crear nueva solicitud con flujo de aprobacion
  async create(request: Omit<PermissionRequest, 'id'>): Promise<PermissionRequest> {
    try {
      const docRef = await addDoc(collection(db, PERMISSIONS_COLLECTION), {
        ...request,
        status: 'Pendiente',
        supervisorApproval: { status: 'pendiente' },
        adminApproval: { status: 'pendiente' },
        createdAt: Timestamp.now(),
      });
      return { ...request, id: docRef.id } as PermissionRequest;
    } catch (error) {
      console.error('Error al crear permiso:', error);
      throw error;
    }
  },

  // Aprobacion/denegacion por supervisor
  async supervisorDecision(
    id: string,
    decision: 'aprobado' | 'denegado',
    userEmail: string,
    userName: string,
    comment?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, PERMISSIONS_COLLECTION, id);
      const newStatus = decision === 'denegado' ? 'Denegado por Supervisor' : 'Aprobado por Supervisor';
      await updateDoc(docRef, {
        'supervisorApproval.status': decision,
        'supervisorApproval.by': userEmail,
        'supervisorApproval.byName': userName,
        'supervisorApproval.date': new Date().toISOString(),
        ...(comment && { 'supervisorApproval.comment': comment }),
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error en decision de supervisor:', error);
      throw error;
    }
  },

  // Aprobacion/denegacion por administrador (solo si supervisor ya aprobo)
  async adminDecision(
    id: string,
    decision: 'aprobado' | 'denegado',
    userEmail: string,
    userName: string,
    comment?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, PERMISSIONS_COLLECTION, id);
      const newStatus = decision === 'denegado' ? 'Denegado por Admin' : 'Aprobado';
      await updateDoc(docRef, {
        'adminApproval.status': decision,
        'adminApproval.by': userEmail,
        'adminApproval.byName': userName,
        'adminApproval.date': new Date().toISOString(),
        ...(comment && { 'adminApproval.comment': comment }),
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error en decision de admin:', error);
      throw error;
    }
  },

  // Actualizar solicitud
  async update(id: string, data: Partial<PermissionRequest>): Promise<void> {
    try {
      const docRef = doc(db, PERMISSIONS_COLLECTION, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al actualizar permiso:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, PERMISSIONS_COLLECTION, id));
    } catch (error) {
      console.error('Error al eliminar permiso:', error);
      throw error;
    }
  },

  // Suscribirse a cambios en tiempo real
  subscribe(callback: (requests: PermissionRequest[]) => void): () => void {
    const unsubscribe = onSnapshot(
      collection(db, PERMISSIONS_COLLECTION),
      (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        })) as PermissionRequest[];

        callback(requests);
      },
      (error) => {
        console.error('Error en suscripción de permisos:', error);
      }
    );
    return unsubscribe;
  },

};

// ============================================
// HORARIOS (employee_schedules)
// ============================================

const SCHEDULES_COLLECTION = 'employee_schedules';

export const schedulesService = {
  // Obtener todos los horarios
  async getAll(): Promise<Record<string, any>> {
    const docRef = doc(db, SCHEDULES_COLLECTION, 'config');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().schedules || {};
    }
    return {};
  },

  // Guardar horarios
  async save(schedules: Record<string, any>): Promise<void> {
    try {
      const docRef = doc(db, SCHEDULES_COLLECTION, 'config');
      await setDoc(docRef, {
        schedules,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al guardar horarios:', error);
      throw error;
    }
  },

  // Suscribirse a cambios
  subscribe(callback: (schedules: Record<string, any>) => void): () => void {
    const docRef = doc(db, SCHEDULES_COLLECTION, 'config');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const schedules = docSnap.data().schedules || {};
          callback(schedules);
        }
      },
      (error) => {
        console.error('Error en suscripción de horarios:', error);
      }
    );
    return unsubscribe;
  },
};

// ============================================
// INGRESOS (incomes)
// ============================================

const INCOMES_COLLECTION = 'incomes';

export const incomesService = {
  // Obtener todos los ingresos
  async getAll(): Promise<IncomeEntry[]> {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, INCOMES_COLLECTION), orderBy('paymentDate', 'desc'))
      );
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as IncomeEntry[];
    } catch (error) {
      console.error('Error al obtener ingresos:', error);
      return [];
    }
  },

  // Obtener ingresos por empleado
  async getByEmployee(employeeName: string): Promise<IncomeEntry[]> {
    const querySnapshot = await getDocs(
      query(
        collection(db, INCOMES_COLLECTION),
        where('employeeName', '==', employeeName),
        orderBy('paymentDate', 'desc')
      )
    );
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as IncomeEntry[];
  },

  // Crear nuevo ingreso
  async create(income: Omit<IncomeEntry, 'id'>): Promise<IncomeEntry> {
    try {
      const docRef = await addDoc(collection(db, INCOMES_COLLECTION), {
        ...income,
        createdAt: Timestamp.now(),
      });
      return { ...income, id: docRef.id } as IncomeEntry;
    } catch (error) {
      console.error('Error al crear ingreso:', error);
      throw error;
    }
  },

  // Actualizar ingreso existente
  async update(incomeId: string, data: Partial<IncomeEntry>): Promise<void> {
    try {
      const docRef = doc(db, INCOMES_COLLECTION, incomeId);
      const { id, ...updateData } = data as IncomeEntry;
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al actualizar ingreso:', error);
      throw error;
    }
  },

  // Eliminar ingreso
  async delete(incomeId: string, employeeName: string): Promise<void> {
    try {
      await deleteDoc(doc(db, INCOMES_COLLECTION, incomeId));
    } catch (error) {
      console.error('Error al eliminar ingreso:', error);
      throw error;
    }
  },

  // Suscribirse a cambios en tiempo real por empleado
  subscribe(employeeName: string, callback: (incomes: IncomeEntry[]) => void): () => void {
    const unsubscribe = onSnapshot(
      query(
        collection(db, INCOMES_COLLECTION),
        where('employeeName', '==', employeeName),
        orderBy('paymentDate', 'desc')
      ),
      (snapshot) => {
        const incomes = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        })) as IncomeEntry[];

        callback(incomes);
      },
      (error) => {
        console.error('Error en suscripción de ingresos:', error);
      }
    );
    return unsubscribe;
  },

};

// ============================================
// CONFIGURACIÓN DE MENÚ (menu_config)
// ============================================

const MENU_CONFIG_COLLECTION = 'menu_config';
const MENU_CONFIG_DOC = 'rh_options';

export interface MenuOptionConfig {
  id: string;
  label: string;
  view: string;
  enabled: boolean;
}

export interface MenuConfig {
  options: MenuOptionConfig[];
  updatedAt?: Timestamp;
}

// Configuración por defecto de las opciones de RH
const DEFAULT_MENU_CONFIG: MenuConfig = {
  options: [
    { id: 'permission-generator', label: 'Permiso Laboral', view: 'rh/permission-generator', enabled: true },
    { id: 'vacation-slip', label: 'Papeleta de vacaciones', view: 'rh/vacation-slip', enabled: true },
    { id: 'loan-request', label: 'Solicitud de Préstamo', view: 'rh/loan-request', enabled: true },
  ],
};

export const menuConfigService = {
  // Obtener configuración actual
  async get(): Promise<MenuConfig> {
    try {
      const docRef = doc(db, MENU_CONFIG_COLLECTION, MENU_CONFIG_DOC);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as MenuConfig;
      }

      // Si no existe, crear con valores por defecto
      await setDoc(docRef, DEFAULT_MENU_CONFIG);
      return DEFAULT_MENU_CONFIG;
    } catch (error) {
      console.error('Error al obtener configuración de menú:', error);
      return DEFAULT_MENU_CONFIG;
    }
  },

  // Actualizar configuración
  async update(config: MenuConfig): Promise<void> {
    try {
      const docRef = doc(db, MENU_CONFIG_COLLECTION, MENU_CONFIG_DOC);
      await setDoc(docRef, {
        ...config,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al actualizar configuración de menú:', error);
      throw error;
    }
  },

  // Suscribirse a cambios en tiempo real
  subscribe(callback: (config: MenuConfig) => void): () => void {
    const docRef = doc(db, MENU_CONFIG_COLLECTION, MENU_CONFIG_DOC);
    const unsubscribe = onSnapshot(
      docRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as MenuConfig);
        } else {
          // Crear con valores por defecto si no existe
          await setDoc(docRef, DEFAULT_MENU_CONFIG);
          callback(DEFAULT_MENU_CONFIG);
        }
      },
      (error) => {
        console.error('Error en suscripción de configuración de menú:', error);
        callback(DEFAULT_MENU_CONFIG);
      }
    );
    return unsubscribe;
  },

  // Habilitar/deshabilitar una opción específica
  async toggleOption(optionId: string, enabled: boolean): Promise<void> {
    const config = await this.get();
    const updatedOptions = config.options.map(opt =>
      opt.id === optionId ? { ...opt, enabled } : opt
    );
    await this.update({ ...config, options: updatedOptions });
  },
};

// ============================================
// USUARIOS DEL SISTEMA (users)
// ============================================

const USERS_COLLECTION = 'users';

export interface SystemUser {
  uid: string;
  email: string;
  role: 'admin' | 'supervisor' | 'employee';
  displayName?: string;
  createdAt: Date;
}

export const usersService = {
  // Obtener todos los usuarios
  async getAll(): Promise<SystemUser[]> {
    const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
    return querySnapshot.docs.map(docSnap => ({
      ...docSnap.data(),
      uid: docSnap.id,
    })) as SystemUser[];
  },

  // Actualizar rol de usuario
  async updateRole(uid: string, role: 'admin' | 'supervisor' | 'employee'): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      await updateDoc(docRef, { role });
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      throw error;
    }
  },

  // Crear documento de usuario en Firestore
  async create(uid: string, data: Omit<SystemUser, 'uid'>): Promise<void> {
    try {
      await setDoc(doc(db, USERS_COLLECTION, uid), {
        uid,
        ...data,
      });
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  },

  // Eliminar usuario de Firestore
  async delete(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, USERS_COLLECTION, uid));
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      throw error;
    }
  },

  // Suscribirse a cambios en tiempo real
  subscribe(callback: (users: SystemUser[]) => void): () => void {
    const unsubscribe = onSnapshot(
      collection(db, USERS_COLLECTION),
      (snapshot) => {
        const users = snapshot.docs.map(docSnap => ({
          ...docSnap.data(),
          uid: docSnap.id,
        })) as SystemUser[];
        callback(users);
      },
      (error) => {
        console.error('Error en suscripción de usuarios:', error);
      }
    );
    return unsubscribe;
  },
};

// ============================================
// AJUSTES DE RETARDOS (tardiness_adjustments)
// ============================================

const TARDINESS_COLLECTION = 'tardiness_adjustments';

export interface TardinessAdjustment {
  id?: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  originalMinutesLate: number;
  adjustedMinutesLate: number;
  hasSanction: boolean;
  reason: string;
  adjustedBy: string;
  adjustedAt?: Date;
}

export const tardinessService = {
  async upsert(employeeName: string, date: string, data: Omit<TardinessAdjustment, 'id'>): Promise<void> {
    const docId = `${employeeName}__${date}`.replace(/\s+/g, '_');
    await setDoc(doc(db, TARDINESS_COLLECTION, docId), {
      ...data,
      adjustedAt: Timestamp.now(),
    });
  },

  subscribe(callback: (adjustments: TardinessAdjustment[]) => void): () => void {
    return onSnapshot(collection(db, TARDINESS_COLLECTION), (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as TardinessAdjustment[];
      callback(data);
    });
  },
};

// ============================================
// CONFIGURACION MENSAJES MOTIVACIONALES (app_settings)
// ============================================

const SETTINGS_COLLECTION = 'app_settings';
const MOTIVATIONAL_DOC = 'motivational_messages';

export interface MotivationalSettings {
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: Date;
}

export const motivationalService = {
  async get(): Promise<MotivationalSettings> {
    const docSnap = await getDoc(doc(db, SETTINGS_COLLECTION, MOTIVATIONAL_DOC));
    if (docSnap.exists()) return docSnap.data() as MotivationalSettings;
    return { enabled: true };
  },

  async setEnabled(enabled: boolean, updatedBy: string): Promise<void> {
    await setDoc(doc(db, SETTINGS_COLLECTION, MOTIVATIONAL_DOC), {
      enabled,
      updatedBy,
      updatedAt: Timestamp.now(),
    });
  },

  subscribe(callback: (settings: MotivationalSettings) => void): () => void {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, MOTIVATIONAL_DOC), (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as MotivationalSettings);
      } else {
        callback({ enabled: true });
      }
    });
  },
};

// ============================================
// TOLERANCIA DE RETARDOS (app_settings)
// ============================================

const TOLERANCE_DOC = 'tardiness_tolerance';

export interface ToleranceSettings {
  minutes: number; // minutos de tolerancia (default 10)
  updatedBy?: string;
  updatedAt?: Date;
}

export const toleranceService = {
  async get(): Promise<ToleranceSettings> {
    const docSnap = await getDoc(doc(db, SETTINGS_COLLECTION, TOLERANCE_DOC));
    if (docSnap.exists()) return docSnap.data() as ToleranceSettings;
    return { minutes: 10 };
  },

  async setMinutes(minutes: number, updatedBy: string): Promise<void> {
    await setDoc(doc(db, SETTINGS_COLLECTION, TOLERANCE_DOC), {
      minutes,
      updatedBy,
      updatedAt: Timestamp.now(),
    });
  },

  subscribe(callback: (settings: ToleranceSettings) => void): () => void {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, TOLERANCE_DOC), (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as ToleranceSettings);
      } else {
        callback({ minutes: 10 });
      }
    });
  },
};

// ============================================
// DASHBOARD LAYOUT (app_settings)
// ============================================

const DASHBOARD_LAYOUT_DOC = 'dashboard_layout';

export const dashboardLayoutService = {
  async get(): Promise<string[]> {
    const docSnap = await getDoc(doc(db, SETTINGS_COLLECTION, DASHBOARD_LAYOUT_DOC));
    if (docSnap.exists()) return docSnap.data().order || [];
    return [];
  },

  async save(order: string[]): Promise<void> {
    await setDoc(doc(db, SETTINGS_COLLECTION, DASHBOARD_LAYOUT_DOC), {
      order,
      updatedAt: Timestamp.now(),
    });
  },

  subscribe(callback: (order: string[]) => void): () => void {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, DASHBOARD_LAYOUT_DOC), (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data().order || []);
      } else {
        callback([]);
      }
    });
  },
};

// ============================================
// CORTES DE NOMINA (payroll_cuts)
// ============================================

const PAYROLL_CUTS_COLLECTION = 'payroll_cuts';

export interface PayrollCutEmployee {
  codigo: string;
  nombre: string;
  fechaIngreso: string;
  diasVacaciones: number;
  aplicaVacaciones: boolean;
  diasTrabajados: number;
  diasPeriodo: number;
  bonoPuntualidad: number;
  bonoObjetivos: number;
  apoyoGasolina: number;
  total: number;
}

export interface PayrollCut {
  id?: string;
  startDate: string;
  endDate: string;
  quincena: number;
  periodLabel: string;
  employees: PayrollCutEmployee[];
  totals: { bonoPuntualidad: number; bonoObjetivos: number; apoyoGasolina: number; total: number };
  createdBy: string;
  createdAt: Date;
}

export const payrollCutsService = {
  async create(data: Omit<PayrollCut, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, PAYROLL_CUTS_COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, PAYROLL_CUTS_COLLECTION, id));
  },

  subscribe(callback: (cuts: PayrollCut[]) => void): () => void {
    return onSnapshot(collection(db, PAYROLL_CUTS_COLLECTION), (snapshot) => {
      const data = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      })) as PayrollCut[];
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(data);
    });
  },
};

// ============================================
// SOLICITUDES DE VACACIONES (vacation_requests)
// ============================================

const VACATION_REQUESTS_COLLECTION = 'vacation_requests';

export interface VacationRequestRecord {
  id?: string;
  employeeId: string; // ID del empleado en detailed_employees
  employeeCode: string;
  employeeName: string;
  hireDate: string;
  dates: string[]; // YYYY-MM-DD[]
  daysRequested: number;
  daysEntitled: number;
  notes?: string;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  createdBy: string;
  createdAt: Date;
}

export const vacationRequestsService = {
  async create(data: Omit<VacationRequestRecord, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, VACATION_REQUESTS_COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async update(id: string, data: Partial<VacationRequestRecord>): Promise<void> {
    await updateDoc(doc(db, VACATION_REQUESTS_COLLECTION, id), data);
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, VACATION_REQUESTS_COLLECTION, id));
  },

  // Obtener dias ya usados por un empleado (solo solicitudes aprobadas o pendientes)
  async getUsedDaysByEmployee(employeeCode: string): Promise<number> {
    const q = query(
      collection(db, VACATION_REQUESTS_COLLECTION),
      where('employeeCode', '==', employeeCode),
    );
    const snapshot = await getDocs(q);
    let totalDays = 0;
    snapshot.docs.forEach(d => {
      const data = d.data();
      if (data.status !== 'rechazada') {
        totalDays += (data.dates?.length || 0);
      }
    });
    return totalDays;
  },

  subscribe(callback: (requests: VacationRequestRecord[]) => void): () => void {
    return onSnapshot(collection(db, VACATION_REQUESTS_COLLECTION), (snapshot) => {
      const data = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      })) as VacationRequestRecord[];
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(data);
    });
  },

  // Suscribirse solo a las de un empleado
  subscribeByEmployee(employeeCode: string, callback: (requests: VacationRequestRecord[]) => void): () => void {
    const q = query(
      collection(db, VACATION_REQUESTS_COLLECTION),
      where('employeeCode', '==', employeeCode),
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      })) as VacationRequestRecord[];
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(data);
    });
  },
};

// ============================================
// FECHAS IMPORTANTES / CALENDARIO (important_dates)
// ============================================

const DATES_COLLECTION = 'important_dates';

export type DateCategory = 'festivo' | 'vacaciones' | 'empresa' | 'capacitacion' | 'otro';

export interface ImportantDate {
  id?: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD para periodos (vacaciones, etc)
  category: DateCategory;
  description?: string;
  recurring: boolean; // se repite cada año
  noLabor: boolean; // no se labora ese dia
  createdBy: string;
  createdAt: Date;
}

export const importantDatesService = {
  async create(data: Omit<ImportantDate, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, DATES_COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async update(id: string, data: Partial<ImportantDate>): Promise<void> {
    await updateDoc(doc(db, DATES_COLLECTION, id), data);
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, DATES_COLLECTION, id));
  },

  subscribe(callback: (dates: ImportantDate[]) => void): () => void {
    return onSnapshot(collection(db, DATES_COLLECTION), (snapshot) => {
      const data = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      })) as ImportantDate[];
      data.sort((a, b) => a.date.localeCompare(b.date));
      callback(data);
    });
  },
};

// ============================================
// ANUNCIOS (announcements)
// ============================================

const ANNOUNCEMENTS_COLLECTION = 'announcements';

export interface Announcement {
  id?: string;
  title: string;
  body: string;
  priority: 'normal' | 'important' | 'urgent';
  createdBy: string; // email
  createdByName: string;
  createdAt: Date;
  expiresAt?: string; // YYYY-MM-DD, opcional
  active: boolean;
}

export const announcementsService = {
  async create(data: Omit<Announcement, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async update(id: string, data: Partial<Announcement>): Promise<void> {
    await updateDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id), data);
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id));
  },

  subscribe(callback: (announcements: Announcement[]) => void): () => void {
    return onSnapshot(collection(db, ANNOUNCEMENTS_COLLECTION), (snapshot) => {
      const data = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      })) as Announcement[];
      // Ordenar por fecha, mas recientes primero
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(data);
    });
  },
};

// ============================================
// POLITICAS INTERNAS (internal_policies)
// ============================================

const POLICIES_COLLECTION = 'internal_policies';
const POLICY_ACKS_COLLECTION = 'policy_acknowledgments';

export interface InternalPolicy {
  id?: string;
  title: string;
  category: string; // 'oficinas' | 'galerias' | 'general' | custom
  content: string; // contenido completo de la politica
  version: number;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PolicyAcknowledgment {
  id?: string;
  policyId: string;
  policyTitle: string;
  policyVersion: number;
  employeeEmail: string;
  employeeName: string;
  acknowledgedAt: Date;
}

export const policiesService = {
  async create(data: Omit<InternalPolicy, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, POLICIES_COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async update(id: string, data: Partial<InternalPolicy>): Promise<void> {
    await updateDoc(doc(db, POLICIES_COLLECTION, id), {
      ...data,
      updatedAt: Timestamp.now(),
    });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, POLICIES_COLLECTION, id));
  },

  subscribe(callback: (policies: InternalPolicy[]) => void): () => void {
    return onSnapshot(collection(db, POLICIES_COLLECTION), (snapshot) => {
      const data = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
      })) as InternalPolicy[];
      data.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
      callback(data.filter(p => p.active));
    });
  },
};

export const policyAcksService = {
  async acknowledge(data: Omit<PolicyAcknowledgment, 'id'>): Promise<void> {
    const docId = `${data.policyId}__${data.employeeEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await setDoc(doc(db, POLICY_ACKS_COLLECTION, docId), {
      ...data,
      acknowledgedAt: Timestamp.now(),
    });
  },

  subscribe(callback: (acks: PolicyAcknowledgment[]) => void): () => void {
    return onSnapshot(collection(db, POLICY_ACKS_COLLECTION), (snapshot) => {
      const data = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
        acknowledgedAt: d.data().acknowledgedAt?.toDate?.() || new Date(),
      })) as PolicyAcknowledgment[];
      callback(data);
    });
  },

  // Obtener acks de un empleado especifico
  subscribeByEmployee(email: string, callback: (acks: PolicyAcknowledgment[]) => void): () => void {
    const q = query(collection(db, POLICY_ACKS_COLLECTION), where('employeeEmail', '==', email));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
        acknowledgedAt: d.data().acknowledgedAt?.toDate?.() || new Date(),
      })) as PolicyAcknowledgment[];
      callback(data);
    });
  },
};

// ============================================
// ATTENDANCE DAYS (resumen validado por día)
// ============================================

const ATTENDANCE_DAYS_COLLECTION = 'attendance_days';

function computeAttendanceDayFromLogs(
  employeeCode: string,
  employeeName: string,
  date: string,
  logs: LogEntry[],
  scheduleStartTime?: string,
  toleranceMinutes = 10,
): Omit<AttendanceDay, 'id'> {
  const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  const checkIn = sorted.find(l => l.type === LogType.ENTRADA);
  const checkOut = [...sorted].reverse().find(l => l.type === LogType.SALIDA);

  const lunchStarts = sorted.filter(l => l.type === LogType.INICIO_COMIDA);
  const lunchEnds = sorted.filter(l => l.type === LogType.FIN_COMIDA);
  const pairs = Math.min(lunchStarts.length, lunchEnds.length);

  const lunchBreaks: { start: number; end: number }[] = [];
  let totalLunchMs = 0;
  for (let i = 0; i < pairs; i++) {
    if (lunchEnds[i].timestamp > lunchStarts[i].timestamp) {
      lunchBreaks.push({ start: lunchStarts[i].timestamp, end: lunchEnds[i].timestamp });
      totalLunchMs += lunchEnds[i].timestamp - lunchStarts[i].timestamp;
    }
  }

  const validationErrors: string[] = [];
  let status: AttendanceDayStatus = 'incomplete';

  if (!checkIn) {
    validationErrors.push('Sin registro de entrada.');
    status = 'anomaly';
  } else if (!checkOut) {
    validationErrors.push('Sin registro de salida.');
    status = 'no_checkout';
  } else if (lunchStarts.length > lunchEnds.length) {
    validationErrors.push(`${lunchStarts.length - lunchEnds.length} pausa(s) de comida sin cierre.`);
    status = 'incomplete_lunch';
  } else {
    status = 'complete';
  }

  let workedMinutes: number | null = null;
  if (checkIn && checkOut) {
    const totalMs = checkOut.timestamp - checkIn.timestamp - totalLunchMs;
    workedMinutes = Math.round(totalMs / (1000 * 60));
  }

  let isLate = false;
  let lateMinutes = 0;
  if (checkIn && scheduleStartTime) {
    const [h, m] = scheduleStartTime.split(':').map(Number);
    const scheduleDate = new Date(checkIn.timestamp);
    scheduleDate.setHours(h, m, 0, 0);
    const deadline = scheduleDate.getTime() + toleranceMinutes * 60 * 1000;
    if (checkIn.timestamp > deadline) {
      isLate = true;
      lateMinutes = Math.round((checkIn.timestamp - scheduleDate.getTime()) / 60000);
    }
  }

  const payableDay = status === 'complete' || status === 'incomplete_lunch';

  return {
    employeeCode,
    employeeName,
    date,
    status,
    checkInTimestamp: checkIn?.timestamp,
    checkOutTimestamp: checkOut?.timestamp,
    lunchBreaks,
    workedMinutes,
    isLate,
    lateMinutes,
    payableDay,
    validationErrors,
    sourceLogIds: sorted.map(l => l.id).filter(Boolean) as string[],
    computedAt: Date.now(),
  };
}

export const attendanceDaysService = {
  async computeAndSave(
    employeeCode: string,
    employeeName: string,
    date: string,
    logs: LogEntry[],
    scheduleStartTime?: string,
    toleranceMinutes?: number,
  ): Promise<void> {
    const dayData = computeAttendanceDayFromLogs(employeeCode, employeeName, date, logs, scheduleStartTime, toleranceMinutes);
    const docId = `${employeeCode || employeeName}__${date}`;
    await setDoc(doc(db, ATTENDANCE_DAYS_COLLECTION, docId), {
      ...dayData,
      computedByUid: auth.currentUser?.uid || '',
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  async getByDateRange(startDate: string, endDate: string): Promise<AttendanceDay[]> {
    try {
      const q = query(
        collection(db, ATTENDANCE_DAYS_COLLECTION),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
      })) as AttendanceDay[];
    } catch (error) {
      console.error('Error al obtener attendance_days:', error);
      return [];
    }
  },

  async getByEmployee(employeeCode: string, startDate: string, endDate: string): Promise<AttendanceDay[]> {
    try {
      const q = query(
        collection(db, ATTENDANCE_DAYS_COLLECTION),
        where('employeeCode', '==', employeeCode),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id,
      })) as AttendanceDay[];
    } catch (error) {
      console.error('Error al obtener attendance_days por empleado:', error);
      return [];
    }
  },

  subscribe(callback: (days: AttendanceDay[]) => void): () => void {
    return onSnapshot(
      query(collection(db, ATTENDANCE_DAYS_COLLECTION), orderBy('date', 'desc')),
      (snapshot) => {
        const days = snapshot.docs.map(d => ({
          ...d.data(),
          id: d.id,
        })) as AttendanceDay[];
        callback(days);
      },
      (error) => {
        console.error('Error en suscripción de attendance_days:', error);
      }
    );
  },
};

// ============================================
// FUNCIÓN PARA LIMPIAR DUPLICADOS
// ============================================

export const cleanDuplicateLogs = async (): Promise<{ deleted: number; found: number }> => {
  console.log('🔍 Buscando registros duplicados en attendance_logs...');

  try {
    const snapshot = await getDocs(collection(db, LOGS_COLLECTION));

    // Crear mapa de logs por timestamp + employeeName + type
    const logsMap = new Map<string, { id: string; data: any }[]>();

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const key = `${data.timestamp}_${data.employeeName}_${data.type}`;

      if (!logsMap.has(key)) {
        logsMap.set(key, []);
      }
      logsMap.get(key)!.push({
        id: docSnap.id,
        data
      });
    });

    // Encontrar duplicados
    const duplicateIds: string[] = [];

    logsMap.forEach((docs, key) => {
      if (docs.length > 1) {
        console.log(`📋 Duplicado: ${key} (${docs.length} registros)`);
        // Mantener el primero, eliminar el resto
        for (let i = 1; i < docs.length; i++) {
          duplicateIds.push(docs[i].id);
        }
      }
    });

    if (duplicateIds.length === 0) {
      console.log('✅ No se encontraron registros duplicados.');
      return { deleted: 0, found: 0 };
    }

    console.log(`🗑️ Eliminando ${duplicateIds.length} registros duplicados...`);

    // Eliminar en batches
    const batchSize = 450;
    let deleted = 0;

    for (let i = 0; i < duplicateIds.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = duplicateIds.slice(i, i + batchSize);

      chunk.forEach(docId => {
        batch.delete(doc(db, LOGS_COLLECTION, docId));
      });

      await batch.commit();
      deleted += chunk.length;
      console.log(`   Eliminados: ${deleted}/${duplicateIds.length}`);
    }

    console.log(`✅ Limpieza completada. ${deleted} registros duplicados eliminados.`);
    return { deleted, found: duplicateIds.length };

  } catch (error) {
    console.error('❌ Error al limpiar duplicados:', error);
    throw error;
  }
};
