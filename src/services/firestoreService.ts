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
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { DetailedEmployee, LogEntry, PermissionRequest, IncomeEntry } from '../../types';

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
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as LogEntry[];
  },

  // Obtener logs por rango de fechas
  async getByDateRange(startDate: Date, endDate: Date): Promise<LogEntry[]> {
    try {
      const startTimestamp = startDate.setHours(0, 0, 0, 0);
      const endTimestamp = endDate.setHours(23, 59, 59, 999);

      const querySnapshot = await getDocs(
        query(
          collection(db, LOGS_COLLECTION),
          where('timestamp', '>=', startTimestamp),
          where('timestamp', '<=', endTimestamp),
          orderBy('timestamp', 'desc')
        )
      );
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
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

      console.log(`Buscando logs para: ${employeeName}, fecha: ${targetDate.toISOString().slice(0,10)}`);

      // Consulta simple solo por employeeName (evita necesidad de índice compuesto)
      const querySnapshot = await getDocs(
        query(
          collection(db, LOGS_COLLECTION),
          where('employeeName', '==', employeeName)
        )
      );

      // Filtrar por fecha en el cliente
      const allLogs = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as LogEntry[];

      const filteredLogs = allLogs
        .filter(log => {
          const logTime = log.timestamp;
          return logTime >= startOfDay.getTime() && logTime <= endOfDay.getTime();
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      console.log(`Logs encontrados: ${filteredLogs.length} de ${allLogs.length} totales`);

      return filteredLogs;
    } catch (error: unknown) {
      console.error('Error al obtener logs por empleado y fecha:', error);
      return [];
    }
  },

  // Crear nuevo log
  async create(log: LogEntry): Promise<void> {
    try {
      await addDoc(collection(db, LOGS_COLLECTION), {
        ...log,
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al crear log:', error);
      throw error;
    }
  },

  // Actualizar log existente (para correcciones del admin)
  async update(logId: string, data: Partial<LogEntry>): Promise<void> {
    try {
      const docRef = doc(db, LOGS_COLLECTION, logId);
      // Removemos el id del objeto data antes de actualizar
      const { id, ...updateData } = data as LogEntry;
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error al actualizar log:', error);
      throw error;
    }
  },

  // Eliminar log (para correcciones del admin)
  async delete(logId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, LOGS_COLLECTION, logId));
    } catch (error) {
      console.error('Error al eliminar log:', error);
      throw error;
    }
  },

  // Suscribirse a cambios en tiempo real
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    const unsubscribe = onSnapshot(
      query(collection(db, LOGS_COLLECTION), orderBy('timestamp', 'desc')),
      (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
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

  // Crear nueva solicitud
  async create(request: Omit<PermissionRequest, 'id'>): Promise<PermissionRequest> {
    try {
      const docRef = await addDoc(collection(db, PERMISSIONS_COLLECTION), {
        ...request,
        createdAt: Timestamp.now(),
      });
      return { ...request, id: docRef.id } as PermissionRequest;
    } catch (error) {
      console.error('Error al crear permiso:', error);
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
