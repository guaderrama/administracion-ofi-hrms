# Lista de Tareas - HRMS "Cerebro Central"

**Ultima Actualizacion:** 2026-02-06

---

## ✅ COMPLETADO

### Fase 1: Fundacion (Backend Setup)
- [x] Crear proyecto en Firebase Console
- [x] Habilitar Authentication (Email/Password)
- [x] Habilitar Firestore Database
- [x] Instalar SDK Firebase en proyecto React
- [x] Crear archivo `firebaseConfig.ts`
- [x] Configurar Firebase Hosting
- [x] Deploy inicial a produccion

### Fase 2: Autenticacion y Perfiles
- [x] Crear AuthContext para manejar sesion global
- [x] Pantalla de Login con Email/Password
- [x] Registro de nuevos usuarios
- [x] Restablecimiento de contrasena
- [x] Asignacion automatica de admin al primer usuario
- [x] Control de acceso basado en roles (RBAC)
- [x] Proteccion de rutas admin-only

### Fase 3: Gestion de Empleados
- [x] Formulario de alta de colaboradores detallados
- [x] Campos: codigo, nombres, apellidos, fecha ingreso, departamento, puesto
- [x] Campos de compensacion: bono puntualidad, bono objetivos, apoyo gasolina
- [x] Listado de personal desde Firestore (tiempo real)
- [x] Edicion de datos de empleados
- [x] Sincronizacion cross-device

### Fase 4: Reloj Checador
- [x] Modulo de registro de asistencia
- [x] Registro de entrada/salida
- [x] Eliminacion de PIN (acceso simplificado)
- [x] Persistencia en Firestore
- [x] Historial de registros

### Fase 5: Recursos Humanos
- [x] Generador de Permisos laborales con PDF
- [x] Papeleta de Vacaciones con PDF
- [x] Auto-llenado por codigo de empleado en Papeleta de Vacaciones
- [x] Calculo automatico de dias de vacaciones (LFT 2023)
- [x] Seleccion de fechas individuales y por periodo
- [x] Exclusion de domingos y opcion de excluir sabados
- [x] Solicitud de Prestamo con PDF
- [x] Toggle de visibilidad de opciones RH (admin controla que ven empleados)
- [x] Persistencia de configuracion de menu en Firestore

### Fase 6: Nominas
- [x] Pagina independiente admin-only
- [x] Selector de periodo (ano, mes, quincena)
- [x] Tabla de empleados con calculo de nomina
- [x] Columnas de vacaciones (dias correspondientes, aplica, fecha ingreso)
- [x] Generacion de recibo PDF individual
- [x] Generacion masiva de recibos PDF
- [x] Vista previa de recibo en pantalla
- [x] Fila de totales generales

### Fase 7: Seguridad
- [x] Firestore Security Rules para todas las colecciones
- [x] Reglas para users, detailed_employees, attendance_logs
- [x] Reglas para permission_requests, employee_schedules, incomes
- [x] Reglas para menu_config
- [x] Reglas para colecciones legacy (attendance, requests, employees)
- [x] Eliminacion de API key expuesta (GEMINI_API_KEY)
- [x] Eliminacion de contrasena hardcodeada
- [x] Proteccion de JSON.parse

### Fase 8: UI/UX
- [x] Diseno responsivo (mobile + desktop)
- [x] Sidebar con navegacion por secciones
- [x] Iconos SVG personalizados
- [x] Estilo glassmorphism con Tailwind CSS

---

## 🔲 PENDIENTE

### Mejoras de Nomina
- [ ] Agregar campo de sueldo base separado
- [ ] Implementar deducciones (ISR, IMSS, Infonavit)
- [ ] Prima vacacional
- [ ] Aguinaldo

### Backend / Cloud Functions
- [ ] Cloud Function para calculo de horas de asistencia (anti-fraude)
- [ ] Cloud Function para cierre automatico de sesiones abiertas
- [ ] Trigger onCreate para perfil de usuario automatico

### Reportes
- [ ] Reporte mensual de asistencia exportable
- [ ] Reporte de nomina consolidado por periodo
- [ ] Exportacion a Excel/CSV

### Notificaciones
- [ ] Notificaciones push para solicitudes pendientes
- [ ] Alertas de cumpleanos/aniversarios de empleados

### Vacaciones Avanzado
- [ ] Historial de vacaciones tomadas por empleado
- [ ] Saldo de dias disponibles vs tomados
- [ ] Aprobacion/rechazo de solicitudes por admin

### Calidad
- [ ] Tests unitarios (Vitest)
- [ ] Tests de integracion
- [ ] CI/CD con GitHub Actions
- [ ] Linting automatizado en pipeline

### Optimizacion
- [ ] Code splitting / Lazy loading
- [ ] Optimizacion de imagenes
- [ ] Paginacion en tablas grandes
- [ ] Indices de Firestore para queries complejas

---

*Documento actualizado conforme se completan tareas. Ver PRD para especificaciones detalladas.*
