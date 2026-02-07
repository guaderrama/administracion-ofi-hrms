# TODO List - HRMS "Cerebro Central"

> Ultima Actualizacion: 2026-02-06

---

## 🔥 High Priority (Proxima Sesion)

- [ ] Verificar que toggles de menu RH funcionan correctamente en produccion
- [ ] Probar generacion de recibos de nomina con datos reales
- [ ] Revisar si se necesita sueldo base separado en nomina

---

## 📋 Medium Priority (Este Mes)

- [ ] Implementar deducciones en nomina (ISR, IMSS, Infonavit)
- [ ] Agregar prima vacacional y aguinaldo
- [ ] Historial de vacaciones tomadas por empleado
- [ ] Aprobacion/rechazo de solicitudes de vacaciones por admin
- [ ] Reportes de asistencia mensual exportables (PDF/CSV)

---

## 💡 Low Priority (Backlog)

- [ ] Cloud Functions para calculo de horas (anti-fraude con serverTimestamp)
- [ ] Cloud Function cierre automatico de sesiones abiertas
- [ ] Notificaciones push para solicitudes pendientes
- [ ] Code splitting / Lazy loading
- [ ] Tests unitarios (Vitest)
- [ ] CI/CD con GitHub Actions
- [ ] Subida de fotos de empleados a Cloud Storage
- [ ] Exportacion a Excel/CSV

---

## ✅ Completed (Reciente)

- [x] **Nominas** - Pagina admin-only con tabla, selector de periodo, PDFs (2026-02-06)
- [x] **Vacaciones en Nominas** - Columnas fecha ingreso, dias vacaciones, aplica (2026-02-06)
- [x] **Auto-llenado Vacaciones** - Busqueda por codigo de empleado en Papeleta (2026-02-06)
- [x] **Toggle Menu RH** - Admin activa/desactiva opciones para empleados (2026-02-06)
- [x] **Firestore Rules menu_config** - Reglas de seguridad para coleccion menu_config (2026-02-06)
- [x] **Eliminacion de PIN** - Checador sin PIN requerido (2026-02-05)
- [x] **Password Reset** - Funcionalidad de restablecimiento de contrasena (2026-02-05)
- [x] **Security Fixes** - Eliminacion GEMINI_API_KEY, contrasena hardcodeada, JSON.parse (2026-02-05)
- [x] **Mobile Responsive** - Diseno responsivo para movil y desktop (2026-02-05)
- [x] **Firestore Index Fix** - Simplificacion de indices (2026-02-05)

---

## 🗑️ Archive

<details>
<summary>Noviembre 2025 - Setup Inicial</summary>

- [x] Setup inicial del proyecto (2025-11-03)
- [x] Configuracion de .claude/ (2025-11-03)
- [x] Instalacion de dependencias (2025-11-03)
- [x] Configuracion Firebase (Auth, Firestore, Hosting)
- [x] AuthContext y Login
- [x] Gestion de empleados (CRUD)
- [x] Reloj Checador
- [x] Generador de Permisos PDF
- [x] Papeleta de Vacaciones PDF
- [x] Solicitud de Prestamo PDF
- [x] Dashboard con Chart.js
- [x] Requisiciones (admin)
- [x] Panel de Administrador
</details>
