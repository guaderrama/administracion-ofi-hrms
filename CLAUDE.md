# Proyecto: ADMINISTRACION-OFI (Sistema HRMS)

## 🎯 Principios de Desarrollo (Context Engineering)

### Design Philosophy
- **KISS**: Keep It Simple, Stupid - Prefiere soluciones simples
- **YAGNI**: You Aren't Gonna Need It - Implementa solo lo necesario  
- **DRY**: Don't Repeat Yourself - Evita duplicación de código
- **SOLID**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion

### Descripción del Proyecto
Sistema de Gestión de Recursos Humanos "Cerebro Central" que centraliza gestión de empleados, control de asistencia (reloj checador) y flujo de aprobación de vacaciones/permisos. Arquitectura serverless con Firebase.

**Estado actual:** Prototipo React funcionando (frontend). En proceso de migración a Firebase backend.

## 🏗️ Tech Stack & Architecture

### Core Stack
- **Runtime**: Node.js + TypeScript
- **Framework**: React 19 + Vite
- **Backend**: Firebase (Serverless Architecture)
  - **Base de Datos**: Firestore (NoSQL)
  - **Auth**: Firebase Authentication (Email/Password)
  - **Storage**: Firebase Cloud Storage (fotos empleados)
  - **Functions**: Firebase Cloud Functions (lógica backend)
  - **Hosting**: Firebase Hosting (deploy SPA)
- **Styling**: Tailwind CSS
- **State Management**: Context API + useState (local first)
- **Charts**: Chart.js
- **PDF Generation**: jsPDF
- **Testing**: Vitest + React Testing Library
- **Schema Validation**: Zod (opcional)

### Architecture: Feature-First + Firebase Serverless

**Enfoque: Arquitectura Feature-First optimizada para desarrollo asistido por IA + Backend Serverless**

Este proyecto usa una arquitectura **Feature-First** donde cada feature es independiente y contiene toda la lógica relacionada (componentes, hooks, servicios, tipos), **integrada con Firebase como backend serverless**.

#### Frontend: Feature-First + Firebase
```
src/
├── components/               # Componentes React (actual)
│   ├── EmployeeForm.tsx     # Formulario de empleados
│   ├── AttendanceTracker.tsx # Reloj checador
│   ├── RequestForm.tsx      # Solicitudes de permisos
│   └── Dashboard.tsx        # Dashboard admin
│
├── contexts/                 # Contextos React (NUEVO)
│   ├── AuthContext.tsx      # Autenticación Firebase
│   └── DataContext.tsx      # Sincronización Firestore
│
├── hooks/                    # Custom hooks (NUEVO)
│   ├── useAuth.ts           # Hook de autenticación
│   ├── useFirestore.ts      # Hook para Firestore
│   └── useFirebaseStorage.ts # Hook para Storage
│
├── services/                 # Servicios API (actual)
│   ├── authService.ts       # Servicio de auth
│   ├── employeeService.ts   # CRUD empleados
│   ├── attendanceService.ts # Gestión asistencia
│   └── requestService.ts    # Gestión permisos
│
├── types/                    # Tipos TypeScript
│   ├── employee.ts          # Tipos de empleado
│   ├── attendance.ts        # Tipos de asistencia
│   └── request.ts           # Tipos de permisos
│
├── utils/                    # Utilidades (actual)
│   └── helpers.ts           # Funciones auxiliares
│
├── firebaseConfig.ts         # Configuración Firebase (NUEVO)
├── App.tsx                   # Componente principal
├── constants.ts              # Constantes globales
└── checadorConstants.ts      # Constantes reloj checador
```

#### Backend: Firebase Cloud Functions
```
functions/
├── src/
│   ├── index.ts             # Entry point
│   ├── triggers/            # Triggers automáticos
│   │   ├── onAttendanceUpdate.ts  # Calcula horas
│   │   └── onUserCreate.ts        # Crea perfil
│   ├── api/                 # Endpoints HTTP
│   │   ├── clockIn.ts       # Marcar entrada
│   │   ├── clockOut.ts      # Marcar salida
│   │   └── generateReport.ts # Generar reportes
│   └── lib/                 # Librerías compartidas
│       └── admin.ts         # Firebase Admin SDK
├── package.json
└── tsconfig.json
```

#### Estructura Firestore (NoSQL)
```
firestore/
├── users/                   # Colección usuarios
│   └── {uid}               # Documento por usuario
│       ├── uid: string
│       ├── email: string
│       ├── fullName: string
│       ├── role: 'admin' | 'employee'
│       ├── position: string
│       ├── photoURL: string
│       └── startDate: Timestamp
│
├── attendance/              # Colección asistencia
│   └── {docId}             # Documento por registro
│       ├── employeeId: string (ref: users)
│       ├── date: string (YYYY-MM-DD)
│       ├── checkIn: Timestamp
│       ├── checkOut: Timestamp | null
│       ├── hoursWorked: number
│       └── status: 'open' | 'completed'
│
└── requests/                # Colección permisos
    └── {docId}             # Documento por solicitud
        ├── employeeId: string (ref: users)
        ├── type: 'vacation' | 'sick' | 'personal'
        ├── startDate: Timestamp
        ├── endDate: Timestamp
        ├── reason: string
        ├── status: 'pending' | 'approved' | 'rejected'
        └── createdAt: Timestamp
```

### Estructura de Proyecto Completa
```
administracion-ofi/
├── src/
│   ├── components/          # Componentes React
│   ├── contexts/            # React Context (Auth, Data)
│   ├── hooks/               # Custom hooks Firebase
│   ├── services/            # Servicios API
│   ├── types/               # TypeScript types
│   ├── utils/               # Utilidades
│   ├── firebaseConfig.ts    # Config Firebase
│   └── App.tsx              # Entry point
├── functions/               # Firebase Cloud Functions
│   └── src/
├── public/                  # Archivos estáticos
├── .claude/                 # Configuración Claude Code
├── docs/                    # Documentación técnica
│   ├── requirements/        # PRD, Arquitectura, Tareas
│   └── README.md            # Índice maestro
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CLAUDE.md               # Este archivo
└── README.md
```

> **🤖 ¿Por qué Feature-First + Firebase?**
>
> Esta estructura fue diseñada específicamente para **desarrollo asistido por IA con backend serverless**:
> - **Localización rápida** de código relacionado
> - **Separación clara** entre frontend (React) y backend (Functions)
> - **Escalabilidad serverless** - pago por uso, auto-scaling
> - **Seguridad integrada** - Firestore Rules + Auth
> - **Migración incremental** - agregar Firebase sin romper lo existente

## 🛠️ Comandos Importantes

### Development
- `npm run dev` - Servidor de desarrollo Vite (puerto 5173)
- `npm run build` - Build para producción
- `npm run preview` - Preview del build

### Firebase
- `firebase login` - Autenticarse en Firebase
- `firebase init` - Inicializar proyecto Firebase
- `firebase deploy` - Deploy completo (hosting + functions)
- `firebase deploy --only hosting` - Deploy solo hosting
- `firebase deploy --only functions` - Deploy solo functions
- `firebase emulators:start` - Emuladores locales

### Quality Assurance
- `npm run test` - Ejecutar tests
- `npm run test:watch` - Tests en modo watch
- `npm run lint` - ESLint
- `npm run lint:fix` - Fix automático de linting
- `npm run typecheck` - Verificación de tipos TypeScript

### Git Workflow
- `git add .` - Stage cambios
- `git commit -m "tipo(scope): mensaje"` - Commit con Conventional Commits
- `git push` - Push a remote

### Quick Reference
**Ver `.claude/docs/MIGRACION_SEGURA.md` para migración Firebase sin romper código existente**

Comandos frecuentes:
```bash
# Firebase
firebase emulators:start        # Start emuladores locales
firebase deploy --only functions:clockIn  # Deploy función específica
firebase firestore:delete --all-collections  # Reset Firestore

# Debugging
lsof -i :5173                  # Check puerto Vite
kill -9 <PID>                  # Kill proceso
tail -f dev.log                # Monitor logs

# Testing
npm run test:watch             # Watch mode
```

## 📝 Convenciones de Código

### File & Function Limits
- **Archivos**: Máximo 500 líneas
- **Funciones**: Máximo 50 líneas
- **Componentes**: Una responsabilidad clara

### Naming Conventions
- **Variables/Functions**: `camelCase`
- **Components**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `camelCase.tsx` o `kebab-case.ts`
- **Folders**: `kebab-case` o `camelCase`

### TypeScript Guidelines
- **Siempre usar type hints** para function signatures
- **Interfaces** para object shapes
- **Types** para unions y primitives
- **Evitar `any`** - usar `unknown` si es necesario

### Component Patterns
```typescript
// ✅ GOOD: Proper component structure
interface EmployeeFormProps {
  onSave: (employee: Employee) => void;
  initialData?: Employee;
}

export function EmployeeForm({ onSave, initialData }: EmployeeFormProps) {
  const [formData, setFormData] = useState(initialData || {});
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

### Firebase Patterns

#### ✅ CORRECTO: Usar serverTimestamp
```typescript
// ✅ GOOD: Server timestamp (anti-fraude)
import { serverTimestamp, addDoc, collection } from 'firebase/firestore';

async function clockIn(employeeId: string) {
  await addDoc(collection(db, 'attendance'), {
    employeeId,
    checkIn: serverTimestamp(), // ← Timestamp del servidor
    checkOut: null,
    status: 'open'
  });
}
```

#### ❌ INCORRECTO: Timestamp del cliente
```typescript
// ❌ BAD: Client timestamp (vulnerable a fraude)
async function clockIn(employeeId: string) {
  await addDoc(collection(db, 'attendance'), {
    employeeId,
    checkIn: new Date(), // ← Usuario puede manipular hora
    checkOut: null,
    status: 'open'
  });
}
```

## 🔒 Security Best Practices

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    
    // Attendance collection
    match /attendance/{docId} {
      allow read: if request.auth.uid == resource.data.employeeId || isAdmin();
      allow write: if false; // Only Cloud Functions write here
    }
    
    // Requests collection
    match /requests/{requestId} {
      allow read: if request.auth.uid == resource.data.employeeId || isAdmin();
      allow create: if request.auth.uid == request.resource.data.employeeId;
      allow update: if isAdmin();
    }
  }
}
```

### Authentication & Authorization
- JWT tokens manejados por Firebase Auth
- Role-based access control (RBAC) con Firestore Rules
- No almacenar tokens en localStorage (Firebase lo maneja)

### Data Protection
- Never log sensitive data (passwords, tokens)
- Use Firebase Security Rules para proteger datos
- Validate all inputs con Zod

## ⚡ Performance Guidelines

### State Management
- **Local state first** - usar useState cuando sea posible
- **Context para auth** - AuthContext para usuario actual
- **Firestore real-time** - onSnapshot para datos en tiempo real
- **Memoization** - useMemo para cálculos costosos

### Firestore Optimization
- **Índices** - crear índices para queries complejas
- **Paginación** - limit() para grandes datasets
- **Denormalización** - duplicar datos para queries rápidas
- **Batch operations** - writeBatch para múltiples escrituras

### Code Splitting
- **Lazy loading** - React.lazy para componentes grandes
- **Dynamic imports** - import() para módulos pesados

## 🔄 Git Workflow & Repository Rules

### Branch Strategy
- `main` - Production ready code
- `develop` - Integration branch (opcional)
- `feature/descripcion` - Feature branches
- `fix/descripcion` - Bug fixes

### Commit Convention (Conventional Commits)
```
type(scope): description

feat(auth): add Firebase authentication
fix(attendance): calculate hours correctly
docs(readme): update Firebase setup
refactor(components): extract EmployeeCard component
```

### Pull Request Rules
- **Tests must pass** antes de merge
- **Linting sin errores**
- **TypeScript sin errores**

## ❌ No Hacer (Critical)

### Code Quality
- ❌ No usar `any` en TypeScript
- ❌ No hacer commits sin probar
- ❌ No omitir manejo de errores
- ❌ No hardcodear configuraciones

### Firebase Security  
- ❌ **CRÍTICO**: No usar `new Date()` para timestamps - siempre `serverTimestamp()`
- ❌ No exponer API keys en cliente (Firebase maneja esto)
- ❌ No escribir directamente a Firestore desde cliente si requiere validación
- ❌ No confiar en el cliente para cálculos críticos (ej: horas trabajadas)

### Migration
- ❌ **CRÍTICO**: No eliminar código que funciona durante migración
- ❌ No refactorizar mientras agregas Firebase
- ❌ No modificar componentes existentes hasta tener Firebase funcionando
- ❌ No hacer cambios masivos de una vez

## 🚨 MIGRACIÓN A FIREBASE - REGLAS CRÍTICAS

### Contexto
Este proyecto está en proceso de migración de prototipo React (solo frontend) a aplicación fullstack con Firebase backend.

### Documentación Completa
**Ver `.claude/docs/MIGRACION_SEGURA.md`** para guía completa de migración sin romper código existente.

### Reglas Obligatorias

1. **PRESERVACIÓN TOTAL**
   - ❌ NO eliminar funciones existentes
   - ❌ NO modificar componentes que funcionan
   - ❌ NO refactorizar durante migración
   - ✅ SÍ agregar Firebase como capa adicional
   - ✅ SÍ mantener estado local funcionando

2. **MIGRACIÓN INCREMENTAL**
   - Una feature a la vez
   - Verificar después de cada cambio
   - Revertir si algo falla
   - Esperar aprobación antes de continuar

3. **WORKFLOW OBLIGATORIO**
   ```
   PLAN → DIFF → APROBAR → IMPLEMENT → TEST → VERIFY
   ```

4. **ESTRATEGIA "SIDE BY SIDE"**
   ```typescript
   // ✅ CORRECTO: Mantener ambas capas
   async function guardarEmpleado(data) {
     // Mantener estado local (que ya funciona)
     setEmpleados([...empleados, data]);
     
     // Agregar persistencia Firebase (nuevo)
     await addDoc(collection(db, 'employees'), data);
   }
   ```

### Prompt Inicial de Migración
Cuando inicies migración, usar:
```
🚨 MIGRACIÓN SEGURA A FIREBASE 🚨
[Ver contenido completo en .claude/docs/MIGRACION_SEGURA.md]
```

## 📂 Sistema .claude/ (Context Engineering)

### Documentación del Sistema

#### `.claude/docs/MIGRACION_SEGURA.md` - Guía de Migración
**Para qué:** Migrar a Firebase sin romper código existente

**Incluye:**
- Prompt de protección crítico
- Workflow seguro en 3 fases
- Señales de alerta
- Plan de emergencia si algo falla
- Ejemplos de código correcto/incorrecto

**Cuándo usar:**
- Al iniciar migración a Firebase
- Si algo se rompe durante migración
- Para consultar ejemplos de migración segura

#### `.claude/docs/WORKFLOW.md` - Workflow de Desarrollo
**Para qué:** Proceso estructurado PLAN → DIFFS → VERIFY

**Cuándo usar:**
- Features nuevas
- Cambios en múltiples archivos
- Refactoring importante

#### `.claude/INDEX.md` - Índice del Sistema
**Para qué:** Mapa de todo el sistema .claude/

**Cuándo usar:**
- Primera vez trabajando en el proyecto
- Para encontrar dónde está cada cosa

#### `.claude/INFRASTRUCTURE_SUMMARY.md` - Resumen de Infraestructura
**Para qué:** Vista rápida del stack técnico

**Incluye:**
- Servicios Firebase necesarios
- Estado actual del proyecto
- Próximos pasos

### Memory System

#### `.claude/memory/NOTES.md` - Session Notes
**Para qué:** Continuidad entre sesiones

**Contenido:**
- Estado actual de la migración
- Progreso del día
- Decisiones tomadas
- Challenges encontrados
- Próximos pasos

**Cuándo actualizar:**
- Al inicio: Lee para retomar contexto
- Durante: Anota decisiones y progreso
- Al final: Resume lo completado

#### `.claude/memory/TODO.md` - Task Management
**Para qué:** Lista organizada de tareas

**Estructura:**
- 🔥 **High Priority** (esta semana)
- 📋 **Medium Priority** (este mes)
- 💡 **Low Priority** (backlog)
- ✅ **Completed** (histórico)

---

## 🔄 Development Workflow: PLAN → DIFFS → VERIFY

### Proceso Estructurado
Este proyecto sigue un workflow estándar para todos los cambios significativos.
Ver **`.claude/docs/WORKFLOW.md`** para documentación completa.

### Las 3 Fases

#### 1️⃣ PLAN (Planificación)
**Qué es:** Explicar QUÉ se hará ANTES de implementar

**Incluye:**
- Descripción clara de la tarea
- Archivos que se van a modificar/crear
- Razón de cada cambio
- Posibles impactos
- Código existente que se preservará

**Ejemplo para migración Firebase:**
```markdown
## PLAN
Voy a agregar autenticación Firebase SIN tocar código existente:

ARCHIVOS NUEVOS:
1. firebaseConfig.ts
   - Por qué: Inicializar Firebase
   - Incluye: configuración, exports de auth/db

2. src/contexts/AuthContext.tsx
   - Por qué: Context para usuario autenticado
   - Incluye: login(), logout(), user state

ARCHIVOS QUE NO TOCARÉ:
- App.tsx (todavía)
- components/* (todos los componentes actuales)
- Ningún archivo existente

VERIFICACIÓN:
- La app debe seguir compilando
- Interfaz debe verse igual
- Botones deben seguir funcionando

¿Procedo con crear SOLO estos archivos nuevos?
```

**Tu respuesta:**
- ✅ "Aprobado" → Claude continúa
- ⚠️ "Modifica X" → Claude ajusta el plan
- ❌ "No" → Claude no hace nada

---

#### 2️⃣ DIFFS (Cambios Específicos)
**Qué es:** Mostrar cambios EXACTOS antes de aplicar

**Formato:**
```typescript
// ===== firebaseConfig.ts (NEW FILE) =====
+ import { initializeApp } from 'firebase/app';
+ import { getAuth } from 'firebase/auth';
+ import { getFirestore } from 'firebase/firestore';
+ 
+ const firebaseConfig = {
+   apiKey: process.env.VITE_FIREBASE_API_KEY,
+   authDomain: "proyecto.firebaseapp.com",
+   projectId: "proyecto",
+   // ... resto de config
+ };
+ 
+ export const app = initializeApp(firebaseConfig);
+ export const auth = getAuth(app);
+ export const db = getFirestore(app);

// ===== EXPLICACIÓN =====
Archivo nuevo que inicializa Firebase.
NO modifica ningún archivo existente.
La app seguirá funcionando igual.

¿Aplicar este cambio?
```

**Tu respuesta:**
- ✅ "Aplica" / "OK" → Claude aplica cambios
- ⚠️ "Cambia X" → Claude ajusta
- ❌ "No" → Claude cancela

---

#### 3️⃣ VERIFY (Verificación)
**Qué es:** Comandos para validar que todo funciona

**Ejemplo:**
```bash
# 1. Verificar que compila
npm run dev
# Debe iniciar sin errores

# 2. Verificar types
npm run typecheck
# 0 errores

# 3. Verificar interfaz
# Abrir http://localhost:5173
# ¿Se ve igual? ✅
# ¿Botones funcionan? ✅
# ¿Sin errores en consola? ✅

# 4. Si todo OK → Continuar con siguiente feature
# Si algo falló → REVERTIR
```

**Tu responsabilidad:**
- ✅ Ejecutar los comandos
- ✅ Reportar resultados
- ✅ Indicar si algo falló

---

### Cuándo Usar Este Workflow

**✅ SÍ usar para:**
- **Migración a Firebase** (SIEMPRE)
- Features nuevas
- Cambios en múltiples archivos
- Integración con Firebase
- Cualquier cosa que pueda romper el código existente

**⚠️ OPCIONAL para:**
- Cambios triviales (fix typo)
- Updates de documentación
- Ajustes de styling menores

**❌ NO necesario para:**
- Leer archivos
- Explorar código
- Responder preguntas

---

### Comandos Útiles

```bash
# Iniciar migración Firebase con workflow
"Lee .claude/docs/MIGRACION_SEGURA.md y sigue el workflow PLAN → DIFFS → VERIFY"

# Durante desarrollo
"Muéstrame el PLAN antes de crear archivos"
"Espera mi 'Aprobado' antes de aplicar DIFFS"
"Dame comandos de VERIFY después de aplicar"

# Si algo falla
"REVERTIR último cambio. Algo se rompió."
```

---

*Este archivo es la fuente de verdad para desarrollo en este proyecto. Todas las decisiones de código deben alinearse con estos principios, especialmente durante la migración a Firebase.*
