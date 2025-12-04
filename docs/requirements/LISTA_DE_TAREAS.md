Como Tech Lead, he estructurado la implementación para escalar tu prototipo visual a una aplicación robusta utilizando Firebase.

Aquí tienes la arquitectura técnica y el checklist de ejecución dividido por capas.

### Arquitectura de Datos (Firestore Schema Strategy)

Antes de programar, definimos la estructura de la base de datos NoSQL para soportar las "3 Carpetas Digitales":

1.  **Colección `employees` (Expediente Maestro):**
    *   `uid` (ID único de Auth), `fullName`, `role` (admin/employee), `photoURL`, `position`, `dateHired`.
2.  **Colección `attendance` (Bitácora de Tiempo):**
    *   Documento por evento o por día. *Recomendación:* Un documento por día por empleado.
    *   Campos: `employeeId`, `date` (YYYY-MM-DD), `checkInTime` (Timestamp), `checkOutTime` (Timestamp), `hoursWorked` (Number), `status` (open/closed).
3.  **Colección `requests` (Buzón de Permisos):**
    *   `employeeId`, `type` (vacation/sick_leave), `startDate`, `endDate`, `status` (pending/approved/rejected), `reason`.

---

### 🟢 PART 1: BACKEND (Firebase & Logic)
*El "Motor" invisible. Se configura en la Consola de Firebase y mediante Cloud Functions.*

#### 1. Configuración del Núcleo
- [ ] **Crear Proyecto Firebase:** Configurar nuevo proyecto en la consola de Google Firebase.
- [ ] **Habilitar Firestore:** Crear base de datos en modo "Producción" (empezaremos con reglas estrictas).
- [ ] **Habilitar Authentication:** Activar proveedor "Email/Password".
    - [ ] *Elite Tip:* Habilitar también Google Auth para facilitar el acceso rápido si tienen correos corporativos.

#### 2. Seguridad y Reglas (Firestore Security Rules)
- [ ] **Definir RBAC (Role-Based Access Control):**
    - [ ] Crear regla: Solo usuarios con `request.auth.token.role == 'admin'` pueden *crear* o *borrar* empleados.
    - [ ] Crear regla: Empleados solo pueden *leer/escribir* en sus propios documentos de `attendance` y `requests`.
    - [ ] Crear regla: Empleados NO pueden modificar el campo `hoursWorked` (eso lo hace el servidor).

#### 3. Cloud Functions (Lógica de Negocio)
*Instalar Firebase CLI para desplegar estas funciones.*
- [ ] **Trigger: Cálculo de Horas (onUpdate `attendance`):**
    - [ ] Cuando se detecta que `checkOutTime` ha sido llenado:
        1. Calcular la diferencia entre `checkInTime` y `checkOutTime`.
        2. Escribir el resultado en el campo `hoursWorked`.
        3. *Esto evita que el frontend manipule las horas calculadas.*
- [ ] **Trigger: Creación de Usuario (onCreate `auth`):**
    - [ ] Cuando se crea un usuario en Auth, crear automáticamente su documento "esqueleto" en la colección `employees`.
- [ ] **API Endpoint (Opcional): Generar Reporte:**
    - [ ] Función HTTPS que recibe un rango de fechas y devuelve el JSON consolidado para el Admin (más eficiente que consultar miles de documentos desde el frontend).

---

### 🔵 PART 2: FRONTEND (React Integration)
*La "Puerta de Entrada" que ya tienes, ahora conectada.*

#### 1. Infraestructura e Instalación
- [ ] **Instalar SDK:** Agregar `firebase` al proyecto (`npm install firebase`).
- [ ] **Configuración:** Crear archivo `firebaseConfig.ts` con las credenciales del proyecto y exportar `auth` y `db` (Firestore).
- [ ] **Contexto de Autenticación:**
    - [ ] Crear un `AuthContext` en React para manejar la sesión global (saber si el usuario está logueado y si es Admin).
    - [ ] Proteger rutas: Si no hay usuario, redirigir a Login.

#### 2. Módulo A: Gestión de Empleados (Admin View)
- [ ] **Formulario de Alta:** Conectar el formulario actual a la función `createUserWithEmailAndPassword` de Firebase.
- [ ] **Subida de Fotos:** Implementar Firebase Storage para guardar la foto de perfil y obtener la URL para guardarla en Firestore.
- [ ] **Listado de Personal:** Reemplazar los datos *hardcoded* por un `useEffect` que haga un `getDocs(collection(db, 'employees'))`.

#### 3. Módulo B: Reloj Checador (Employee View)
- [ ] **Lógica de Entrada:**
    - [ ] Botón "Entrada": Crea un documento en `attendance` con `checkInTime: serverTimestamp()` (usar timestamp del servidor evita fraudes cambiando la hora del PC).
- [ ] **Lógica de Salida:**
    - [ ] Botón "Salida": Busca el documento "abierto" de hoy y hace un `updateDoc` con `checkOutTime: serverTimestamp()`.
- [ ] **Estado Visual:** Determinar si mostrar botón "Entrada" o "Salida" basándose en si existe un registro abierto para el día actual.

#### 4. Módulo C: Reportes y Permisos
- [ ] **Envío de Solicitudes:** Formulario que hace `addDoc` a la colección `requests`.
- [ ] **Dashboard Admin:**
    - [ ] Conectar `Chart.js` (que ya tienes) para leer de la colección `attendance`.
    - [ ] Filtrar datos por mes.
- [ ] **Generación PDF:** Modificar la función actual de `jspdf` para que espere a que los datos asíncronos de Firebase carguen antes de "tomar la foto" del PDF.

### 🚀 Orden de Ejecución Recomendado

1.  **Backend:** Configura Firebase y Auth primero. Sin esto, el frontend no tiene a dónde conectarse.
2.  **Frontend (Auth):** Logra que puedas iniciar sesión.
3.  **Frontend (Alta):** Logra crear un empleado.
4.  **Frontend (Reloj):** Logra marcar entrada/salida.
5.  **Backend (Functions):** Implementa el cálculo automático de horas.
6.  **Frontend (Reportes):** Visualiza los datos.

¿Te gustaría que te genere el código del archivo de configuración de Firebase (`firebaseConfig.ts`) y el Contexto de Autenticación para empezar?