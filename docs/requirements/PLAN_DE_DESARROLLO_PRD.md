Aquí tienes el **Documento de Requerimientos del Producto (PRD)** y la **Arquitectura Técnica**, diseñados por un perfil Senior de Arquitectura de Software y Product Management.

Este documento puentea la brecha entre el "Plan Sencillo" (Visión de Negocio) y el código actual (Prototipo Visual), estableciendo la infraestructura en Firebase.

---

# PRD: Sistema de Gestión de Recursos Humanos (HRMS) "Cerebro Central"

**Versión:** 1.0 (MVP)
**Estado:** Definición de Arquitectura
**Tecnología:** React 19 + Tailwind (Frontend) / Firebase (Backend)

---

## 1. Resumen Ejecutivo
Transformar la interfaz visual actual de "Permisos Laborales" en una Plataforma SaaS operativa (Single Page Application). El sistema centralizará la gestión de empleados, el control de asistencia (reloj checador) y el flujo de aprobación de vacaciones/permisos, persistiendo toda la información en la nube de forma segura.

---

## 2. Perfiles de Usuario (Personas)

| Perfil | Rol | Necesidades Principales |
| :--- | :--- | :--- |
| **Administrador (RRHH/Jefe)** | `admin` | Dar de alta empleados, ver dashboard de asistencia, aprobar/rechazar permisos, descargar reportes PDF. |
| **Colaborador** | `employee` | Marcar entrada/salida (rápido), solicitar vacaciones, ver su historial y estatus de solicitudes. |

---

## 3. Arquitectura de Datos (Firestore)

Como Arquitecto, he diseñado una estructura **NoSQL** en Firestore optimizada para lecturas rápidas y escalabilidad. No anidaremos sub-colecciones profundamente para facilitar los reportes globales.

### A. Colección: `users` (El Expediente Maestro)
*Almacena el perfil y rol. Vinculado al Firebase Auth UID.*

```json
{
  "uid": "string (PK - from Auth)",
  "email": "string",
  "fullName": "string",
  "role": "string ('admin' | 'employee')",
  "position": "string",
  "photoURL": "string (Firebase Storage)",
  "startDate": "timestamp",
  "vacationDaysAvailable": "number",
  "isActive": "boolean"
}
```

### B. Colección: `attendance` (La Bitácora de Tiempo)
*Registros inmutables de tiempo. Cada documento es una sesión o un evento.*

```json
{
  "id": "auto-generated",
  "employeeId": "string (ref: users)",
  "employeeName": "string (denormalized for reporting speed)",
  "date": "string (YYYY-MM-DD)",
  "checkIn": "timestamp",
  "checkOut": "timestamp (null if active)",
  "durationHours": "number (calculated on checkout)",
  "status": "string ('on-time', 'late', 'completed')"
}
```

### C. Colección: `requests` (El Buzón de Permisos)
*Solicitudes de vacaciones o permisos especiales.*

```json
{
  "id": "auto-generated",
  "employeeId": "string (ref: users)",
  "type": "string ('vacation', 'sick', 'personal')",
  "startDate": "timestamp",
  "endDate": "timestamp",
  "reason": "string",
  "status": "string ('pending', 'approved', 'rejected')",
  "createdAt": "timestamp"
}
```

---

## 4. Especificaciones Funcionales y Técnicas

### 4.1. Módulo de Autenticación y Seguridad
*   **Frontend:** Crear pantalla de Login. Integrar `firebase/auth`.
*   **Lógica:** Permitir login con Email/Password.
*   **Seguridad (Firestore Rules):**
    *   `users`: Cualquiera autenticado puede leer su propio perfil. Solo `admin` puede crear/editar otros perfiles.
    *   `attendance`: Empleados solo pueden *crear* registros y leer los suyos. Solo `admin` puede editar registros pasados (corrección de errores).
    *   `requests`: Empleados crean. Solo `admin` actualiza el campo `status`.

### 4.2. Módulo "Reloj Checador" (Bitácora)
*   **Lógica de Negocio:**
    1.  Al cargar la app, verificar si el usuario tiene un registro con `checkOut: null`.
    2.  Si existe: Mostrar botón "Marcar Salida".
    3.  Si no existe: Mostrar botón "Marcar Entrada".
*   **Cloud Function (Opcional para Fase 2):**
    *   *Cron Job:* A las 11:59 PM, buscar entradas sin salida y cerrarlas automáticamente o marcar "Olvido de salida".

### 4.3. Módulo de Dashboard y Reportes
*   **Frontend:**
    *   Usar `Chart.js` (ya incluido) para mostrar horas trabajadas vs. horas esperadas.
    *   Tabla de empleados activos en tiempo real.
*   **Lógica:**
    *   Consulta a Firestore: `attendance.where('date', '==', today)`.
*   **Exportación:**
    *   Usar `jspdf` para generar el reporte de nómina o asistencia mensual basado en los datos traídos de Firestore.

---

## 5. Plan de Implementación (Hoja de Ruta)

Dada tu base de código actual, este es el orden lógico de desarrollo:

### Fase 1: La Fundación (Backend Setup)
1.  Crear proyecto en **Firebase Console**.
2.  Habilitar **Authentication** (Email/Pass).
3.  Habilitar **Firestore Database**.
4.  Instalar SDK en tu proyecto React: `npm install firebase`.
5.  Crear archivo `firebaseConfig.js` para conectar la app.

### Fase 2: Identidad (Auth & Perfiles)
1.  Crear contexto de React (`AuthContext`) para manejar la sesión del usuario.
2.  Formulario de Alta de Empleados (Solo visible para Admin) -> Guarda en `users`.

### Fase 3: Operatividad (Asistencia)
1.  Crear lógica de botones Entrada/Salida.
2.  Al dar "Entrada" -> `addDoc(collection(db, 'attendance'), { checkIn: new Date(), ... })`.
3.  Al dar "Salida" -> Buscar doc abierto -> `updateDoc(docRef, { checkOut: new Date() })`.

### Fase 4: Visualización
1.  Conectar las gráficas de `Chart.js` a los datos reales de Firestore.
2.  Generación de PDF con datos reales.

---

## 6. Recomendación del Arquitecto (Nota Técnica)

He notado que estás usando librerías vía CDN en un entorno React. Para la integración con Firebase, te recomiendo encarecidamente **migrar a un entorno de desarrollo local con Node.js (Vite o Create React App)** si es posible.

Si debes mantenerte en el formato actual (CDN/HTML directo), deberás importar Firebase usando la sintaxis de módulos ES adecuada para navegadores:

```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore.js";
// ... configuración
```

**¿Por dónde quieres empezar?** Puedo generarte el código para el archivo de configuración de Firebase (`firebaseConfig.js`) o el componente de `Login`.