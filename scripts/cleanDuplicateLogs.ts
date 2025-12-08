// Script para limpiar registros duplicados en Firestore
// Ejecutar desde la consola del navegador mientras estás logueado como admin

import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../src/firebaseConfig';

interface LogEntry {
  employeeName: string;
  type: string;
  timestamp: number;
  location?: {
    lat: number;
    lon: number;
  };
}

interface FirestoreDoc {
  id: string;
  data: LogEntry;
}

export async function cleanDuplicateLogs(): Promise<void> {
  console.log('🔍 Buscando registros duplicados...');

  try {
    const logsCollection = collection(db, 'attendance_logs');
    const snapshot = await getDocs(logsCollection);

    // Crear mapa de logs por timestamp + employeeName
    const logsMap = new Map<string, FirestoreDoc[]>();

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data() as LogEntry;
      const key = `${data.timestamp}_${data.employeeName}_${data.type}`;

      if (!logsMap.has(key)) {
        logsMap.set(key, []);
      }
      logsMap.get(key)!.push({
        id: docSnap.id,
        data
      });
    });

    // Encontrar duplicados (más de 1 registro con la misma clave)
    const duplicates: string[] = [];

    logsMap.forEach((docs, key) => {
      if (docs.length > 1) {
        // Mantener el primero, eliminar el resto
        console.log(`📋 Duplicado encontrado: ${key} (${docs.length} registros)`);
        for (let i = 1; i < docs.length; i++) {
          duplicates.push(docs[i].id);
        }
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ No se encontraron registros duplicados.');
      return;
    }

    console.log(`🗑️ Eliminando ${duplicates.length} registros duplicados...`);

    // Eliminar duplicados
    let deleted = 0;
    for (const docId of duplicates) {
      await deleteDoc(doc(db, 'attendance_logs', docId));
      deleted++;
      if (deleted % 10 === 0) {
        console.log(`   Eliminados: ${deleted}/${duplicates.length}`);
      }
    }

    console.log(`✅ Limpieza completada. ${deleted} registros duplicados eliminados.`);

  } catch (error) {
    console.error('❌ Error al limpiar duplicados:', error);
    throw error;
  }
}

// Función para ejecutar desde la consola del navegador
(window as any).cleanDuplicateLogs = cleanDuplicateLogs;
