# 📚 Documentación del Proyecto - Sistema de Gestión de Recursos Humanos "Cerebro Central"

**Última actualización:** 03 de Diciembre, 2025

## 🎯 Propósito de esta carpeta

Transformar la interfaz visual actual de "Permisos Laborales" (prototipo React) en una **Plataforma SaaS operativa** (Single Page Application). El sistema centralizará la gestión de empleados, el control de asistencia (reloj checador) y el flujo de aprobación de vacaciones/permisos, persistiendo toda la información en la nube de forma segura mediante arquitectura serverless con Firebase.

---

## 📋 Los documentos principales

### 1️⃣ PLAN_DE_DESARROLLO_PRD.md - LEER PRIMERO
**Autor:** Product Manager Senior / Arquitecto de Software  
**Tipo:** Product Requirements Document (PRD)  
**Páginas aproximadas:** 6 páginas

**Qué contiene:**
- Resumen ejecutivo del sistema HRMS
- Perfiles de usuario detallados (Admin vs Colaborador)
- Arquitectura de datos completa en Firestore (users, attendance, requests)
- Especificaciones funcionales y técnicas por módulo
- Plan de implementación en 4 fases
- Recomendaciones del arquitecto sobre migración

**Por qué leerlo primero:**
Establece la visión de negocio completa, define QUÉ problema resuelve el sistema, PARA QUIÉN está diseñado y CUÁL es el objetivo final. Es el documento que conecta los requerimientos de negocio con la implementación técnica.

---

### 2️⃣ ARQUITECTURA_TECNICA.md - LEER SEGUNDO
**Autor:** Arquitecto de Soluciones  
**Tipo:** Especificación Técnica de Arquitectura  
**Páginas aproximadas:** 5 páginas

**Qué contiene:**
- Mapa de servicios Firebase (tabla de requerimientos vs servicios)
- Modelo de datos Firestore detallado (schema JSON para 3 colecciones)
- Lógica de negocio con Cloud Functions (clockIn, clockOut)
- Estrategia de seguridad completa con Firestore Security Rules
- Próximos pasos técnicos para implementación

**Por qué leerlo segundo:**
Define CÓMO construir técnicamente lo que el PRD especificó. Contiene las decisiones de arquitectura serverless, el diseño de la base de datos NoSQL y las reglas de seguridad que protegen el sistema.

---

### 3️⃣ LISTA_DE_TAREAS.md - LEER TERCERO
**Autor:** Tech Lead  
**Tipo:** Checklist de Implementación  
**Páginas aproximadas:** 4 páginas

**Qué contiene:**
- Arquitectura de datos (Firestore Schema Strategy)
- PART 1: Checklist completo de Backend (Firebase & Logic)
- PART 2: Checklist completo de Frontend (React Integration)
- Módulos A, B, C detallados (Empleados, Reloj Checador, Reportes)
- Orden de ejecución recomendado en 6 pasos

**Por qué leerlo tercero:**
Desglosa el PASO A PASO de implementación con checkboxes accionables. Conecta la configuración del backend con la integración del frontend, proporcionando una ruta clara de desarrollo.

---

## 🔄 Orden de lectura recomendado para Claude

### FASE 1: Entender el negocio
1. Lee `PLAN_DE_DESARROLLO_PRD.md` completo
   - Enfócate en: Perfiles de usuario (Admin vs Colaborador), arquitectura de datos Firestore, especificaciones funcionales por módulo, plan de implementación en 4 fases

### FASE 2: Comprender la arquitectura
2. Lee `ARQUITECTURA_TECNICA.md` completo
   - Enfócate en: Mapa de servicios Firebase, modelo de datos Firestore (users, attendance, requests), lógica de Cloud Functions (clockIn/clockOut), Firestore Security Rules con RBAC

### FASE 3: Revisar implementación
3. Lee `LISTA_DE_TAREAS.md` completo
   - Enfócate en: Checklist de backend (configuración Firebase, seguridad, Cloud Functions), checklist de frontend (módulos A/B/C), orden de ejecución recomendado

---

## 💡 Información técnica clave

### Stack tecnológico principal

**Frontend:**
- React 19
- Tailwind CSS
- Chart.js (visualización de datos)
- jsPDF (generación de reportes PDF)

**Backend (Firebase):**
- Firebase Authentication (Email/Password + Google Auth)
- Firestore Database (NoSQL)
- Cloud Functions (lógica de negocio serverless)
- Cloud Storage (fotos de empleados, justificantes)
- Firebase Hosting (deploy de SPA)

**Herramientas de desarrollo:**
- Node.js
- Firebase CLI
- Vite o Create React App (recomendado)
- TypeScript (opcional)

### Servicios Firebase necesarios

- ✅ **Authentication** - Email/Password + Google Auth (opcional)
- ✅ **Firestore Database** - 3 colecciones principales (users, attendance, requests)
- ✅ **Cloud Functions** - Triggers para cálculo automático de horas
- ✅ **Cloud Storage** - Almacenamiento de fotos de perfil y documentos
- ✅ **Hosting** - Deploy de la aplicación React

### Problemas críticos identificados

⚠️ **ESTADO ACTUAL - CÁSCARA VACÍA**  
El prototipo actual es solo interfaz visual sin persistencia. Los datos se pierden al recargar la página. No existe backend real.

⚠️ **SEGURIDAD CRÍTICA - TIMESTAMPS**  
Nunca confiar en el reloj del dispositivo del usuario. Si un empleado cambia la hora de su celular, podría falsificar su entrada. Solución: usar `serverTimestamp()` de Firebase en Cloud Functions.

⚠️ **ARQUITECTURA REQUERIDA - RBAC**  
Implementar Role-Based Access Control (RBAC) con Firestore Security Rules para que:
- Empleados solo vean sus propios registros
- Solo admins puedan crear/editar otros perfiles
- Nadie pueda manipular `hoursWorked` desde el frontend

⚠️ **MIGRACIÓN NECESARIA**  
Si actualmente se usa React vía CDN, migrar a entorno Node.js (Vite/CRA) para mejor integración con Firebase SDK y manejo de módulos ES.

---

## 🎯 Objetivo final del proyecto

Convertir el prototipo visual React actual en un **Sistema de Gestión de Recursos Humanos (HRMS)** empresarial llamado "Cerebro Central" con:

1. **Autenticación segura** - Credencial invisible única por empleado (Firebase Auth)
2. **Persistencia en la nube** - Carpetas digitales en Firestore (expediente, bitácora, buzón)
3. **Reloj checador anti-fraude** - Timestamps del servidor, no del cliente
4. **Dashboard administrativo** - Reportes en tiempo real con Chart.js
5. **Flujo de aprobación** - Solicitudes de vacaciones/permisos con estados
6. **Exportación PDF** - Reportes de nómina y asistencia mensual

**Arquitectura:** Serverless en Firebase para escalabilidad automática y costo-eficiencia (pago por uso).

---

## ⚠️ Notas importantes

1. **Backend First**: Configurar Firebase y Authentication antes de tocar el frontend. Sin esto, no hay a dónde conectarse.

2. **Security Rules desde Día 1**: No dejar reglas en modo test. Implementar RBAC inmediatamente para evitar vulnerabilidades.

3. **Cloud Functions para lógica crítica**: Todo cálculo de horas, validaciones de tiempo y operaciones sensibles deben ejecutarse en el servidor, nunca en el cliente.

4. **Denormalización intencional**: El campo `employeeName` en `attendance` está duplicado para optimizar velocidad de consultas en reportes (patrón NoSQL válido).

5. **Orden de desarrollo sugerido**:
   - Backend (Auth + Firestore) → Login funcional → Alta de empleados → Reloj checador → Cloud Functions → Reportes

---

## 📂 Estructura de archivos de documentación

```
docs/
├── README.md                    ← Este archivo (índice maestro)
├── PLAN_DE_DESARROLLO_PRD.md    ← Visión de negocio y especificaciones
├── ARQUITECTURA_TECNICA.md      ← Diseño técnico y seguridad
└── LISTA_DE_TAREAS.md           ← Checklist de implementación
```

---

**📌 Nota para desarrolladores/IAs:**  
Estos documentos están diseñados para ser leídos en orden. El PRD establece el "qué y por qué", la Arquitectura define el "cómo", y las Tareas desglosan el "paso a paso". Seguir este orden garantiza comprensión completa del sistema antes de escribir código.
