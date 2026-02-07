# PRD: Sistema de Gestion de Recursos Humanos (HRMS) "Cerebro Central"

**Version:** 2.0
**Estado:** MVP Funcional - En Produccion
**Ultima Actualizacion:** 2026-02-06
**URL Produccion:** https://administracion-ofi-hrms.web.app
**Repositorio:** https://github.com/guaderrama/administracion-ofi-hrms
**Branch Principal:** `feature/role-based-access`
**Tecnologia:** React 19 + Vite + Tailwind CSS (Frontend) / Firebase (Backend)

---

## 1. Resumen Ejecutivo

Sistema HRMS operativo desplegado en produccion que centraliza la gestion de empleados, control de asistencia (reloj checador), flujo de aprobacion de vacaciones/permisos, generacion de documentos PDF y calculo de nominas quincenales. La informacion persiste en Firebase Firestore con autenticacion y control de acceso basado en roles (RBAC).

---

## 2. Perfiles de Usuario

| Perfil | Rol | Acceso |
| :--- | :--- | :--- |
| **Administrador (RRHH/Jefe)** | `admin` | Dashboard, Checador, RH completo, Requisiciones, Nominas, Panel Admin, Configuracion de menu |
| **Colaborador** | `employee` | Dashboard, Checador, opciones de RH habilitadas por admin |

---

## 3. Arquitectura de Datos (Firestore - Estado Actual)

### Colecciones Activas

#### A. `users` - Perfiles de usuario y roles
```json
{
  "uid": "string (PK - from Firebase Auth)",
  "email": "string",
  "displayName": "string",
  "role": "admin | employee",
  "createdAt": "timestamp"
}
```

#### B. `detailed_employees` - Expediente completo de colaboradores
```json
{
  "id": "auto-generated",
  "codigo": "string (codigo de empleado unico)",
  "nombres": "string",
  "paterno": "string (apellido paterno)",
  "materno": "string (apellido materno)",
  "fechaIngreso": "string (YYYY-MM-DD)",
  "departamento": "string",
  "puesto": "string",
  "bonoPuntualidad": "number",
  "bonoObjetivos": "number",
  "apoyoGasolina": "number"
}
```

#### C. `attendance_logs` - Registros de asistencia
```json
{
  "id": "auto-generated",
  "date": "string (YYYY-MM-DD)",
  "employeeName": "string",
  "checkIn": "timestamp",
  "checkOut": "timestamp | null",
  "status": "string"
}
```

#### D. `permission_requests` - Solicitudes de permisos
```json
{
  "id": "auto-generated",
  "employeeId": "string",
  "type": "vacation | sick | personal",
  "startDate": "string",
  "endDate": "string",
  "reason": "string",
  "status": "pending | approved | rejected",
  "createdAt": "timestamp"
}
```

#### E. `employee_schedules` - Horarios de empleados
```json
{
  "id": "auto-generated",
  "employeeId": "string",
  "schedule": "object (configuracion de horario)"
}
```

#### F. `incomes` - Registros de ingresos economicos
```json
{
  "id": "auto-generated",
  "description": "string",
  "amount": "number",
  "date": "string",
  "category": "string"
}
```

#### G. `menu_config` - Configuracion de menu RH
```json
{
  "id": "rh_menu",
  "options": [
    {
      "id": "permission-generator",
      "label": "Generador de Permisos",
      "view": "permission-generator",
      "enabled": true
    },
    {
      "id": "vacation-slip",
      "label": "Papeleta de Vacaciones",
      "view": "vacation-slip",
      "enabled": true
    },
    {
      "id": "loan-request",
      "label": "Solicitud de Prestamo",
      "view": "loan-request",
      "enabled": true
    }
  ]
}
```

#### H. Colecciones Legacy (compatibilidad)
- `attendance` - Registros de asistencia (formato anterior)
- `requests` - Solicitudes (formato anterior)
- `employees` - Empleados (formato anterior)

---

## 4. Modulos Implementados

### 4.1. Autenticacion y Seguridad [COMPLETADO]
- Login con Email/Password via Firebase Auth
- Registro de nuevos usuarios
- Restablecimiento de contrasena
- Control de acceso basado en roles (RBAC)
- Primer usuario registrado se asigna como admin automaticamente
- Firestore Security Rules para todas las colecciones

### 4.2. Dashboard [COMPLETADO]
- Vista principal con metricas generales
- Graficas con Chart.js
- Accesible para todos los usuarios autenticados

### 4.3. Reloj Checador [COMPLETADO]
- Registro de entrada/salida
- Sin PIN requerido (simplificado)
- Registros persistidos en Firestore
- Historial de asistencia
- Sincronizacion cross-device en tiempo real

### 4.4. Recursos Humanos (RH) [COMPLETADO]

#### 4.4.1. Generador de Permisos
- Formulario para solicitudes de permisos laborales
- Generacion de PDF con jsPDF + html2canvas
- Vista previa antes de descarga

#### 4.4.2. Papeleta de Vacaciones
- Auto-llenado de datos por codigo de empleado
- Busqueda en tiempo real desde Firestore
- Calculo automatico de dias de vacaciones segun LFT 2023
- Seleccion de fechas individuales o por periodo
- Opcion de excluir sabados como dia de descanso
- Validacion: domingos automaticamente excluidos
- Generacion de PDF

#### 4.4.3. Solicitud de Prestamo
- Formulario de solicitud de prestamo
- Generacion de PDF

#### 4.4.4. Configuracion de Menu (Admin)
- Admin puede activar/desactivar opciones de RH para empleados
- Botones ON/OFF con persistencia en Firestore
- Empleados solo ven opciones habilitadas
- Admin siempre ve todas las opciones

### 4.5. Gestion de Empleados (Admin) [COMPLETADO]
- Alta de colaboradores con datos completos
- Codigo de empleado unico
- Datos laborales: departamento, puesto, fecha ingreso
- Datos de compensacion: bono puntualidad, bono objetivos, apoyo gasolina
- Listado y edicion de colaboradores
- Datos sincronizados en tiempo real

### 4.6. Nominas (Admin) [COMPLETADO]
- Pagina independiente solo para admin
- Selector de periodo: Ano, Mes, Quincena (1ra/2da)
- Tabla de empleados con columnas:
  - Codigo, Nombre, Fecha Ingreso
  - Dias de Vacaciones (segun anos trabajados, LFT 2023)
  - Aplica Vacaciones (Si/No segun >= 1 ano)
  - Bono Puntualidad, Bono Objetivos, Apoyo Gasolina
  - Total (suma de los 3 bonos)
- Fila de totales generales
- Generacion de recibo PDF individual por empleado
- Generacion masiva de todos los recibos
- Vista previa del recibo en pantalla

### 4.7. Requisiciones (Admin) [COMPLETADO]
- Sistema de requisiciones
- Solo visible para administradores

### 4.8. Panel de Administrador [COMPLETADO]
- Gestion de usuarios y roles
- Configuraciones del sistema

---

## 5. Calculo de Vacaciones (LFT 2023)

Tabla implementada segun la Ley Federal del Trabajo reformada en 2023:

| Anos Trabajados | Dias de Vacaciones |
| :--- | :--- |
| < 1 ano | 0 (no aplica) |
| 1 ano | 12 dias |
| 2 anos | 14 dias |
| 3 anos | 16 dias |
| 4 anos | 18 dias |
| 5 anos | 20 dias |
| 6-10 anos | 22 dias |
| 11-15 anos | 24 dias |
| 16-20 anos | 26 dias |
| 21-25 anos | 28 dias |
| 26-30 anos | 30 dias |
| 31-35 anos | 32 dias |

---

## 6. Calculo de Nomina

**Formula actual:** `Neto a Pagar = Bono Puntualidad + Bono Objetivos + Apoyo Gasolina`

- Sin deducciones por ahora (bruto = neto)
- Periodo: Quincenal (1ra: dias 1-15, 2da: dias 16-fin de mes)

---

## 7. Seguridad (Firestore Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    function isAuthenticated() {
      return request.auth != null;
    }
    // Reglas por coleccion:
    // users: lectura autenticados, escritura admin + propio usuario
    // detailed_employees: lectura autenticados, escritura admin
    // attendance_logs: lectura autenticados, crear autenticados, editar/borrar admin
    // permission_requests: lectura autenticados, crear autenticados, editar/borrar admin
    // employee_schedules: lectura autenticados, escritura admin
    // incomes: lectura autenticados, crear autenticados, editar/borrar admin
    // menu_config: lectura autenticados, escritura admin
  }
}
```

---

## 8. Infraestructura de Despliegue

| Servicio | Uso | Estado |
| :--- | :--- | :--- |
| Firebase Authentication | Login Email/Password | Activo |
| Firestore Database | Base de datos NoSQL | Activo |
| Firebase Hosting | Hosting del SPA | Activo |
| Firebase Cloud Storage | Fotos de empleados | Disponible |

---

## 9. Generacion de PDFs

Patron usado en toda la aplicacion:
- **Libreria:** jsPDF + html2canvas (cargados via CDN)
- **Metodo:** Renderizar HTML con `id="pdf-content-*"`, capturar con html2canvas, convertir a PDF
- **Archivos que generan PDF:**
  - Papeleta de Vacaciones
  - Generador de Permisos
  - Solicitud de Prestamo
  - Recibos de Nomina (individual y masivo)

---

## 10. Proximas Mejoras (Backlog)

- [ ] Agregar sueldo base como campo separado en el calculo de nomina
- [ ] Implementar deducciones (ISR, IMSS, etc.)
- [ ] Cloud Functions para calculo de horas de asistencia
- [ ] Reportes de asistencia mensual exportables
- [ ] Notificaciones push para solicitudes pendientes
- [ ] Historial de vacaciones tomadas vs disponibles
- [ ] Subida de fotos de empleados a Cloud Storage
- [ ] Tests unitarios e integracion
- [ ] CI/CD con GitHub Actions

---

*Documento mantenido por el equipo de desarrollo. Ultima revision: 2026-02-06.*
