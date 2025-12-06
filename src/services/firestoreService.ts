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
import type { DetailedEmployee, LogEntry, PermissionRequest } from '../../types';

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
      return querySnapshot.docs.map(doc => doc.data() as LogEntry);
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
      return querySnapshot.docs.map(doc => doc.data() as LogEntry);
    } catch (error) {
      console.error('Error al obtener logs por fecha:', error);
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

  // Suscribirse a cambios en tiempo real
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    const unsubscribe = onSnapshot(
      query(collection(db, LOGS_COLLECTION), orderBy('timestamp', 'desc')),
      (snapshot) => {
        const logs = snapshot.docs.map(doc => doc.data() as LogEntry);
        localStorage.setItem('all_employee_logs', JSON.stringify(logs));
        callback(logs);
      },
      (error) => {
        console.error('Error en suscripción de logs:', error);
      }
    );
    return unsubscribe;
  },

  // Sincronizar localStorage con Firestore
  async syncFromLocalStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('all_employee_logs');
      if (!stored) return;

      const localLogs: LogEntry[] = JSON.parse(stored);
      const batch = writeBatch(db);
      let count = 0;

      for (const log of localLogs) {
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
      console.log('Logs sincronizados con Firestore');
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
