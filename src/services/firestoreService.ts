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
    try {
      const querySnapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as DetailedEmployee[];
    } catch (error) {
      console.error('Error al obtener empleados:', error);
      // Fallback a localStorage si Firestore falla
      const stored = localStorage.getItem('detailed_employees');
      return stored ? JSON.parse(stored) : [];
    }
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
      const newEmployee = { ...employee, id: docRef.id };

      // También guardar en localStorage como backup
      const stored = localStorage.getItem('detailed_employees');
      const employees = stored ? JSON.parse(stored) : [];
      employees.push(newEmployee);
      localStorage.setItem('detailed_employees', JSON.stringify(employees));

      return newEmployee;
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

      // Actualizar localStorage
      const stored = localStorage.getItem('detailed_employees');
      if (stored) {
        const employees = JSON.parse(stored);
        const index = employees.findIndex((e: DetailedEmployee) => e.id === id);
        if (index !== -1) {
          employees[index] = { ...employees[index], ...data };
          localStorage.setItem('detailed_employees', JSON.stringify(employees));
        }
      }
    } catch (error) {
      console.error('Error al actualizar empleado:', error);
      throw error;
    }
  },

  // Eliminar empleado
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));

      // Eliminar de localStorage
      const stored = localStorage.getItem('detailed_employees');
      if (stored) {
        const employees = JSON.parse(stored);
        const filtered = employees.filter((e: DetailedEmployee) => e.id !== id);
        localStorage.setItem('detailed_employees', JSON.stringify(filtered));
      }
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

        // Actualizar localStorage
        localStorage.setItem('detailed_employees', JSON.stringify(employees));
        callback(employees);
      },
      (error) => {
        console.error('Error en suscripción de empleados:', error);
      }
    );
    return unsubscribe;
  },

  // Sincronizar localStorage con Firestore (migración inicial)
  async syncFromLocalStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('detailed_employees');
      if (!stored) return;

      const localEmployees: DetailedEmployee[] = JSON.parse(stored);
      const batch = writeBatch(db);

      for (const emp of localEmployees) {
        const docRef = doc(db, EMPLOYEES_COLLECTION, emp.id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          batch.set(docRef, {
            ...emp,
            syncedAt: Timestamp.now(),
          });
        }
      }

      await batch.commit();
      console.log('Empleados sincronizados con Firestore');
    } catch (error) {
      console.error('Error al sincronizar empleados:', error);
    }
  },
};

// ============================================
// REGISTROS DE ASISTENCIA (attendance_logs)
// ============================================

const LOGS_COLLECTION = 'attendance_logs';

export const logsService = {
  // Obtener todos los logs
  async getAll(): Promise<LogEntry[]> {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, LOGS_COLLECTION), orderBy('timestamp', 'desc'))
      );
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as LogEntry[];
    } catch (error) {
      console.error('Error al obtener logs:', error);
      const stored = localStorage.getItem('all_employee_logs');
      return stored ? JSON.parse(stored) : [];
    }
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

      const querySnapshot = await getDocs(
        query(
          collection(db, LOGS_COLLECTION),
          where('employeeName', '==', employeeName),
          where('timestamp', '>=', startOfDay.getTime()),
          where('timestamp', '<=', endOfDay.getTime()),
          orderBy('timestamp', 'asc')
        )
      );
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as LogEntry[];
    } catch (error) {
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

      // También guardar en localStorage
      const stored = localStorage.getItem('all_employee_logs');
      const logs = stored ? JSON.parse(stored) : [];
      logs.push(log);
      localStorage.setItem('all_employee_logs', JSON.stringify(logs));
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

      // Actualizar localStorage
      const stored = localStorage.getItem('all_employee_logs');
      if (stored) {
        const logs = JSON.parse(stored);
        const index = logs.findIndex((l: LogEntry) => l.id === logId);
        if (index !== -1) {
          logs[index] = { ...logs[index], ...updateData };
          localStorage.setItem('all_employee_logs', JSON.stringify(logs));
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
      await deleteDoc(doc(db, LOGS_COLLECTION, logId));

      // Eliminar de localStorage
      const stored = localStorage.getItem('all_employee_logs');
      if (stored) {
        const logs = JSON.parse(stored);
        const filtered = logs.filter((l: LogEntry) => l.id !== logId);
        localStorage.setItem('all_employee_logs', JSON.stringify(filtered));
      }
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
        localStorage.setItem('all_employee_logs', JSON.stringify(logs));
        callback(logs);
      },
      (error) => {
        console.error('Error en suscripción de logs:', error);
      }
    );
    return unsubscribe;
  },

  // Sincronizar localStorage con Firestore (solo una vez)
  async syncFromLocalStorage(): Promise<void> {
    try {
      // Verificar si ya se sincronizó anteriormente
      const alreadySynced = localStorage.getItem('logs_synced_to_firestore');
      if (alreadySynced === 'true') {
        console.log('Logs ya fueron sincronizados previamente');
        return;
      }

      const stored = localStorage.getItem('all_employee_logs');
      if (!stored) return;

      const localLogs: LogEntry[] = JSON.parse(stored);
      if (localLogs.length === 0) return;

      // Obtener logs existentes en Firestore para evitar duplicados
      const existingLogs = await getDocs(collection(db, LOGS_COLLECTION));
      const existingTimestamps = new Set(
        existingLogs.docs.map(doc => doc.data().timestamp)
      );

      // Filtrar solo logs que no existen en Firestore
      const newLogs = localLogs.filter(log => !existingTimestamps.has(log.timestamp));

      if (newLogs.length === 0) {
        console.log('No hay logs nuevos para sincronizar');
        localStorage.setItem('logs_synced_to_firestore', 'true');
        return;
      }

      const batch = writeBatch(db);
      let count = 0;

      for (const log of newLogs) {
        const docRef = doc(collection(db, LOGS_COLLECTION));
        batch.set(docRef, {
          ...log,
          syncedAt: Timestamp.now(),
        });
        count++;

        // Firestore batch tiene límite de 500 operaciones
        if (count >= 450) {
          await batch.commit();
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      // Marcar como sincronizado para no repetir
      localStorage.setItem('logs_synced_to_firestore', 'true');
      console.log(`${newLogs.length} logs sincronizados con Firestore`);
    } catch (error) {
      console.error('Error al sincronizar logs:', error);
    }
  },
};

// ============================================
// SOLICITUDES DE PERMISO (permission_requests)
// ============================================

const PERMISSIONS_COLLECTION = 'permission_requests';

export const permissionsService = {
  // Obtener todas las solicitudes
  async getAll(): Promise<PermissionRequest[]> {
    try {
      const querySnapshot = await getDocs(collection(db, PERMISSIONS_COLLECTION));
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as PermissionRequest[];
    } catch (error) {
      console.error('Error al obtener permisos:', error);
      const stored = localStorage.getItem('permission_requests');
      return stored ? JSON.parse(stored) : [];
    }
  },

  // Crear nueva solicitud
  async create(request: Omit<PermissionRequest, 'id'>): Promise<PermissionRequest> {
    try {
      const docRef = await addDoc(collection(db, PERMISSIONS_COLLECTION), {
        ...request,
        createdAt: Timestamp.now(),
      });
      const newRequest = { ...request, id: docRef.id };

      // También guardar en localStorage
      const stored = localStorage.getItem('permission_requests');
      const requests = stored ? JSON.parse(stored) : [];
      requests.push(newRequest);
      localStorage.setItem('permission_requests', JSON.stringify(requests));

      return newRequest as PermissionRequest;
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

      // Actualizar localStorage
      const stored = localStorage.getItem('permission_requests');
      if (stored) {
        const requests = JSON.parse(stored);
        const index = requests.findIndex((r: PermissionRequest) => r.id === id);
        if (index !== -1) {
          requests[index] = { ...requests[index], ...data };
          localStorage.setItem('permission_requests', JSON.stringify(requests));
        }
      }
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

        localStorage.setItem('permission_requests', JSON.stringify(requests));
        callback(requests);
      },
      (error) => {
        console.error('Error en suscripción de permisos:', error);
      }
    );
    return unsubscribe;
  },

  // Sincronizar localStorage con Firestore
  async syncFromLocalStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('permission_requests');
      if (!stored) return;

      const localRequests: PermissionRequest[] = JSON.parse(stored);
      const batch = writeBatch(db);

      for (const req of localRequests) {
        const docRef = doc(db, PERMISSIONS_COLLECTION, req.id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          batch.set(docRef, {
            ...req,
            syncedAt: Timestamp.now(),
          });
        }
      }

      await batch.commit();
      console.log('Permisos sincronizados con Firestore');
    } catch (error) {
      console.error('Error al sincronizar permisos:', error);
    }
  },
};

// ============================================
// HORARIOS (employee_schedules)
// ============================================

const SCHEDULES_COLLECTION = 'employee_schedules';

export const schedulesService = {
  // Obtener todos los horarios
  async getAll(): Promise<Record<string, any>> {
    try {
      const docRef = doc(db, SCHEDULES_COLLECTION, 'config');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().schedules || {};
      }
      return {};
    } catch (error) {
      console.error('Error al obtener horarios:', error);
      const stored = localStorage.getItem('employee_schedules');
      return stored ? JSON.parse(stored) : {};
    }
  },

  // Guardar horarios
  async save(schedules: Record<string, any>): Promise<void> {
    try {
      const docRef = doc(db, SCHEDULES_COLLECTION, 'config');
      await setDoc(docRef, {
        schedules,
        updatedAt: Timestamp.now(),
      });

      // También guardar en localStorage
      localStorage.setItem('employee_schedules', JSON.stringify(schedules));
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
          localStorage.setItem('employee_schedules', JSON.stringify(schedules));
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
    try {
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
    } catch (error) {
      console.error('Error al obtener ingresos por empleado:', error);
      // Fallback a localStorage
      const key = `incomes_${employeeName.replace(/\s+/g, '_')}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    }
  },

  // Crear nuevo ingreso
  async create(income: Omit<IncomeEntry, 'id'>): Promise<IncomeEntry> {
    try {
      const docRef = await addDoc(collection(db, INCOMES_COLLECTION), {
        ...income,
        createdAt: Timestamp.now(),
      });
      const newIncome = { ...income, id: docRef.id };

      // También guardar en localStorage como backup
      const key = `incomes_${income.employeeName.replace(/\s+/g, '_')}`;
      const stored = localStorage.getItem(key);
      const incomes = stored ? JSON.parse(stored) : [];
      incomes.push(newIncome);
      localStorage.setItem(key, JSON.stringify(incomes));

      return newIncome as IncomeEntry;
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

      // Actualizar localStorage
      if (data.employeeName) {
        const key = `incomes_${data.employeeName.replace(/\s+/g, '_')}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          const incomes = JSON.parse(stored);
          const index = incomes.findIndex((i: IncomeEntry) => i.id === incomeId);
          if (index !== -1) {
            incomes[index] = { ...incomes[index], ...updateData };
            localStorage.setItem(key, JSON.stringify(incomes));
          }
        }
      }
    } catch (error) {
      console.error('Error al actualizar ingreso:', error);
      throw error;
    }
  },

  // Eliminar ingreso
  async delete(incomeId: string, employeeName: string): Promise<void> {
    try {
      await deleteDoc(doc(db, INCOMES_COLLECTION, incomeId));

      // Eliminar de localStorage
      const key = `incomes_${employeeName.replace(/\s+/g, '_')}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const incomes = JSON.parse(stored);
        const filtered = incomes.filter((i: IncomeEntry) => i.id !== incomeId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
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

        // Actualizar localStorage
        const key = `incomes_${employeeName.replace(/\s+/g, '_')}`;
        localStorage.setItem(key, JSON.stringify(incomes));
        callback(incomes);
      },
      (error) => {
        console.error('Error en suscripción de ingresos:', error);
      }
    );
    return unsubscribe;
  },

  // Migrar ingresos de localStorage a Firestore
  async syncFromLocalStorage(employeeName: string): Promise<void> {
    try {
      const key = `incomes_${employeeName.replace(/\s+/g, '_')}`;
      const stored = localStorage.getItem(key);
      if (!stored) return;

      const localIncomes: IncomeEntry[] = JSON.parse(stored);
      if (localIncomes.length === 0) return;

      // Verificar qué ingresos ya existen en Firestore
      const existingIncomes = await this.getByEmployee(employeeName);
      const existingIds = new Set(existingIncomes.map(i => i.id));

      const batch = writeBatch(db);
      let count = 0;

      for (const income of localIncomes) {
        if (!existingIds.has(income.id)) {
          const docRef = doc(collection(db, INCOMES_COLLECTION));
          batch.set(docRef, {
            ...income,
            syncedAt: Timestamp.now(),
          });
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        console.log(`${count} ingresos de ${employeeName} sincronizados con Firestore`);
      }
    } catch (error) {
      console.error('Error al sincronizar ingresos:', error);
    }
  },
};

// ============================================
// FUNCIÓN DE MIGRACIÓN COMPLETA
// ============================================

export const migrateAllDataToFirestore = async (): Promise<void> => {
  console.log('Iniciando migración de datos a Firestore...');

  try {
    await employeesService.syncFromLocalStorage();
    await logsService.syncFromLocalStorage();
    await permissionsService.syncFromLocalStorage();

    // Migrar horarios
    const storedSchedules = localStorage.getItem('employee_schedules');
    if (storedSchedules) {
      await schedulesService.save(JSON.parse(storedSchedules));
    }

    console.log('Migración completada exitosamente');
  } catch (error) {
    console.error('Error durante la migración:', error);
  }
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
