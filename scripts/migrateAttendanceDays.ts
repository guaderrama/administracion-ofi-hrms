/**
 * Script de migración: genera AttendanceDay desde attendance_logs históricos.
 *
 * Ejecutar desde la consola del navegador o como script admin:
 *   1. Importar y llamar migrateAttendanceDays() desde la consola dev
 *   2. O agregarlo temporalmente a un botón admin en AdminView
 *
 * Este script:
 *   - Lee todos los attendance_logs
 *   - Los agrupa por empleado + fecha (hora local)
 *   - Computa un AttendanceDay por cada grupo
 *   - Escribe los resultados a la colección attendance_days
 */

import {
  collection,
  getDocs,
  setDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../src/firebaseConfig';
import type { LogEntry } from '../types';
import { LogType } from '../types';
import type { AttendanceDayStatus } from '../types';
import { toLocalDateKey } from '../utils/dateUtils';

const LOGS_COLLECTION = 'attendance_logs';
const ATTENDANCE_DAYS_COLLECTION = 'attendance_days';

function normalizeTimestamp(ts: any): number {
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  return Date.now();
}

export async function migrateAttendanceDays(): Promise<{ processed: number; written: number }> {
  console.log('Iniciando migración de AttendanceDay...');

  // 1. Leer todos los logs
  const snapshot = await getDocs(collection(db, LOGS_COLLECTION));
  const allLogs: LogEntry[] = snapshot.docs.map(d => ({
    ...d.data(),
    id: d.id,
    timestamp: normalizeTimestamp(d.data().timestamp),
  })) as LogEntry[];

  console.log(`Logs encontrados: ${allLogs.length}`);

  // 2. Agrupar por empleado + fecha local
  const groups: Record<string, LogEntry[]> = {};
  allLogs.forEach(log => {
    const date = toLocalDateKey(log.timestamp);
    const empKey = log.employeeCode || log.employeeName;
    const key = `${empKey}__${date}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  });

  console.log(`Grupos empleado/día: ${Object.keys(groups).length}`);

  // 3. Computar y escribir en batches
  const entries = Object.entries(groups);
  let written = 0;
  const batchSize = 400;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = entries.slice(i, i + batchSize);

    chunk.forEach(([key, logs]) => {
      const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);
      const firstLog = sorted[0];
      const date = toLocalDateKey(firstLog.timestamp);
      const employeeCode = firstLog.employeeCode || '';
      const employeeName = firstLog.employeeName;

      const checkIn = sorted.find(l => l.type === LogType.ENTRADA);
      const checkOut = [...sorted].reverse().find(l => l.type === LogType.SALIDA);
      const lunchStarts = sorted.filter(l => l.type === LogType.INICIO_COMIDA);
      const lunchEnds = sorted.filter(l => l.type === LogType.FIN_COMIDA);
      const pairs = Math.min(lunchStarts.length, lunchEnds.length);

      const lunchBreaks: { start: number; end: number }[] = [];
      let totalLunchMs = 0;
      for (let j = 0; j < pairs; j++) {
        if (lunchEnds[j].timestamp > lunchStarts[j].timestamp) {
          lunchBreaks.push({ start: lunchStarts[j].timestamp, end: lunchEnds[j].timestamp });
          totalLunchMs += lunchEnds[j].timestamp - lunchStarts[j].timestamp;
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
        validationErrors.push(`${lunchStarts.length - lunchEnds.length} pausa(s) sin cierre.`);
        status = 'incomplete_lunch';
      } else {
        status = 'complete';
      }

      let workedMinutes: number | null = null;
      if (checkIn && checkOut) {
        workedMinutes = Math.round((checkOut.timestamp - checkIn.timestamp - totalLunchMs) / (1000 * 60));
      }

      const payableDay = status === 'complete' || status === 'incomplete_lunch';
      const docId = `${employeeCode || employeeName}__${date}`;

      batch.set(doc(db, ATTENDANCE_DAYS_COLLECTION, docId), {
        employeeCode,
        employeeName,
        date,
        status,
        checkInTimestamp: checkIn?.timestamp || null,
        checkOutTimestamp: checkOut?.timestamp || null,
        lunchBreaks,
        workedMinutes,
        isLate: false, // Sin info de horario en migración, se puede recomputar después
        lateMinutes: 0,
        payableDay,
        validationErrors,
        sourceLogIds: sorted.map(l => l.id).filter(Boolean),
        computedAt: Date.now(),
        migratedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    written += chunk.length;
    console.log(`Progreso: ${written}/${entries.length}`);
  }

  console.log(`Migración completada. ${written} AttendanceDay creados.`);
  return { processed: entries.length, written };
}
