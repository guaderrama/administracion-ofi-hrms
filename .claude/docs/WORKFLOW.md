# Development Workflow

> Proceso estándar para trabajar con Claude/Cline en este proyecto

---

## 🎯 Overview

Este proyecto sigue el workflow **PLAN → DIFFS → VERIFY** para todos los cambios significativos. Esto asegura:
- ✅ Cambios bien pensados antes de implementar
- ✅ Revisión clara de qué se va a modificar
- ✅ Validación de que todo funciona
- ✅ Control sobre qué se aplica

---

## 📋 Workflow: PLAN → DIFFS → VERIFY

### 1️⃣ PLAN (Planificación)

**Qué es:**
Claude/Cline explica qué va a hacer ANTES de hacerlo.

**Incluye:**
- Descripción clara de la tarea
- Archivos que se van a modificar
- Razón de cada cambio
- Posibles impactos

**Ejemplo:**
```markdown
## PLAN

Voy a implementar autenticación básica:

1. Crear `lib/auth.ts`
   - Por qué: Centralizar lógica de auth
   - Incluye: login(), logout(), getSession()

2. Modificar `app/layout.tsx`
   - Por qué: Agregar AuthProvider
   - Cambios: Wrap children con provider

3. Crear `middleware.ts`
   - Por qué: Proteger rutas privadas
   - Redirige a /login si no autenticado

¿Procedo con estos cambios?
```

**Tu respuesta:**
- ✅ "Sí" / "Procede" / "OK" → Continúa al paso 2
- ⚠️ "Modifica X" → Claude ajusta el plan
- ❌ "No" → Claude no hace nada

---

### 2️⃣ DIFFS (Cambios Específicos)

**Qué es:**
Claude muestra los cambios exactos que va a aplicar, como un `git diff`.

**Formato:**
```diff
// lib/auth.ts (NEW FILE)
+ export async function login(email: string, password: string) {
+   const { data, error } = await supabase.auth.signInWithPassword({
+     email,
+     password
+   })
+   return { data, error }
+ }

// app/layout.tsx (MODIFIED)
  export default function RootLayout({ children }) {
    return (
      <html>
        <body>
+         <AuthProvider>
            {children}
+         </AuthProvider>
        </body>
      </html>
    )
  }
```

**Tu respuesta:**
- ✅ "Aplica" / "OK" / "Sí" → Continúa al paso 3
- ⚠️ "Cambia X" → Claude ajusta diffs
- ❌ "No apliques" → Claude no hace nada

---

### 3️⃣ VERIFY (Verificación)

**Qué es:**
Comandos específicos para validar que todo funciona.

**Ejemplo:**
```bash
# 1. Verificar build
npm run build
# Debe completar sin errores

# 2. Verificar types
npm run typecheck
# 0 errores

# 3. Verificar tests
npm run test
# Todos los tests pasan

# 4. Probar manualmente
npm run dev
# 1. Ir a /login
# 2. Ingresar credenciales
# 3. Debe redirigir a /dashboard
# 4. Logout debe funcionar
```

**Tu responsabilidad:**
- ✅ Ejecutar los comandos
- ✅ Reportar resultados
- ✅ Indicar si algo falló

---

## 🔄 Proceso Completo (Ejemplo)

### Tú:
```
Implementa autenticación con Supabase
```

### Claude:
```markdown
## PLAN

Implementaré autenticación básica con los siguientes cambios:

1. **lib/auth.ts** (nuevo)
   - Razón: Funciones centralizadas de auth
   - Funciones: login(), logout(), getSession()

2. **app/layout.tsx** (modificar)
   - Razón: Proveer contexto de auth
   - Cambio: Agregar AuthProvider

3. **middleware.ts** (nuevo)
   - Razón: Proteger rutas
   - Funcionalidad: Redirect si no autenticado

4. **app/(auth)/login/page.tsx** (nuevo)
   - Razón: UI de login
   - Form con email/password

¿Procedo con este plan?
```

### Tú:
```
Sí, procede
```

### Claude:
```markdown
## DIFFS

// lib/auth.ts (NEW)
+ import { supabase } from './supabase'
+ 
+ export async function login(email: string, password: string) {
+   const { data, error } = await supabase.auth.signInWithPassword({
+     email,
+     password
+   })
+   if (error) throw error
+   return data
+ }
+ 
+ export async function logout() {
+   const { error } = await supabase.auth.signOut()
+   if (error) throw error
+ }

// app/layout.tsx (MODIFIED)
  import './globals.css'
+ import { AuthProvider } from '@/components/auth-provider'

  export default function RootLayout({ children }) {
    return (
      <html>
        <body>
+         <AuthProvider>
            {children}
+         </AuthProvider>
        </body>
      </html>
    )
  }

// ... más diffs ...

¿Aplicar estos cambios?
```

### Tú:
```
Sí, aplica
```

### Claude:
```markdown
✅ Cambios aplicados.

## VERIFY

Ejecuta estos comandos para verificar:

```bash
# 1. Type check
npm run typecheck

# 2. Build
npm run build

# 3. Tests
npm run test

# 4. Manual test
npm run dev
# Navega a /login
# Intenta login con credenciales válidas
# Debe redirigir a /dashboard
# Logout debe funcionar

Reporta los resultados.
```

### Tú:
```
Todo funciona correctamente ✅
```

---

## 🎨 Variaciones del Workflow

### Cambios Pequeños (Skip PLAN)
Para cambios triviales, Claude puede saltarse el PLAN:
```markdown
Voy a agregar un console.log en handleClick para debug.

¿Procedo?
```

### Cambios Grandes (Extended PLAN)
Para features complejas, el PLAN puede ser más detallado:
```markdown
## PLAN COMPLETO

### Phase 1: Database Setup
1. Crear migration para tabla users
2. Agregar RLS policies
3. Seed initial data

### Phase 2: API Layer
1. Crear API routes en /api/auth
2. Implementar rate limiting
3. Agregar error handling

### Phase 3: UI Layer
... etc ...

¿Procedo con Phase 1?
```

---

## 💡 Comandos Útiles para Workflow

### Iniciar Tarea
```
Usa bucle-agentico para implementar [feature]

Workflow:
1. PLAN completo primero
2. Muestra DIFFS antes de aplicar
3. Dame comandos de VERIFY
```

### Continuar Sesión
```
Lee .claude/memory/NOTES.md y continuemos con [tarea X]

Recuerda: PLAN → DIFFS → VERIFY
```

### Revisar Cambios
```
Antes de aplicar cambios, muéstrame:
1. Qué archivos se modifican
2. Qué líneas cambian
3. Por qué es necesario cada cambio
```

---

## 🚫 Anti-Patterns (NO hacer)

### ❌ Aplicar Sin Revisar
```
# MAL:
Haz todos los cambios sin mostrarme nada

# BIEN:
Muéstrame el PLAN y DIFFS antes de aplicar
```

### ❌ Skip VERIFY
```
# MAL:
Cambios aplicados. [Sin verificación]

# BIEN:
Cambios aplicados. Verifica con:
npm run typecheck && npm run test
```

### ❌ Plan Vago
```
# MAL:
PLAN: Voy a arreglar el bug

# BIEN:
PLAN: 
1. Modificar components/Button.tsx línea 45
   - Razón: onClick no estaba tipado
   - Cambio: Agregar tipo MouseEventHandler
2. Actualizar tests
```

---

## 📚 Integración con Sistema .claude/

### Documentar Decisiones
Después de VERIFY exitoso:
```
Documenta esta decisión en .claude/memory/DECISIONS.md:
- Qué implementamos
- Por qué elegimos esta approach
- Alternativas consideradas
```

### Actualizar TODO
```
Actualiza .claude/memory/TODO.md:
- Marca [tarea X] como completada
- Agrega nuevas tareas identificadas
```

### Registrar en Task
```
Actualiza .claude/tasks/0001-auth.md:
- Status: ✅ Completed
- Lessons learned: [lo que aprendimos]
```

---

## 🎯 Checklist por Cambio

### Antes de Implementar
- [ ] Entiendo qué se va a cambiar
- [ ] El PLAN tiene sentido
- [ ] No hay impactos inesperados
- [ ] Estoy de acuerdo con el approach

### Durante Implementación
- [ ] Revisé los DIFFS línea por línea
- [ ] No hay cambios extraños
- [ ] Los imports son correctos
- [ ] El tipado es correcto

### Después de Aplicar
- [ ] Ejecuté todos los comandos de VERIFY
- [ ] Todo pasa sin errores
- [ ] Probé manualmente la funcionalidad
- [ ] Documenté decisiones importantes

---

## 🔧 Configurar en tu Proyecto

### 1. Agrega a CLAUDE.md
```markdown
## Workflow Estándar

Este proyecto sigue PLAN → DIFFS → VERIFY.
Ver .claude/docs/WORKFLOW.md para detalles.

NUNCA aplicar cambios sin:
1. Mostrar PLAN
2. Mostrar DIFFS
3. Proveer comandos VERIFY
4. Esperar aprobación
```

### 2. Recuérdale a Claude
```
Lee .claude/docs/WORKFLOW.md antes de hacer cambios
```

### 3. En cada sesión
```
Trabajemos con el workflow PLAN → DIFFS → VERIFY
```

---

## ✅ Beneficios de este Workflow

1. ✅ **Control total** - Nada se aplica sin tu aprobación
2. ✅ **Transparencia** - Ves exactamente qué cambia
3. ✅ **Aprendizaje** - Entiendes cada cambio
4. ✅ **Seguridad** - Reduces riesgo de bugs
5. ✅ **Documentación** - Queda registro del razonamiento
6. ✅ **Reversibilidad** - Fácil de revertir si algo falla

---

## 📖 Referencias

- Inspired by Cline's methodical approach
- Adaptado para uso con Claude
- Compatible con .claude/ system
- Optimizado para proyectos Next.js/React

---

## 💬 Frases Útiles

**Para empezar:**
- "Usa el workflow PLAN → DIFFS → VERIFY"
- "Planifica antes de implementar"
- "Muéstrame los cambios antes de aplicar"

**Durante desarrollo:**
- "Espera, muéstrame el PLAN primero"
- "¿Qué archivos vas a modificar?"
- "Explica por qué este cambio es necesario"

**Para verificar:**
- "Dame comandos específicos para verificar"
- "¿Cómo pruebo que funciona?"
- "¿Qué tests debo correr?"

---

## 🎓 Aprende Más

Este workflow se integra con:
- `.claude/memory/` - Tracking de progreso
- `.claude/tasks/` - Documentación de features
- Bucle agéntico - Metodología iterativa
- Comandos del sistema - Automatización

Lee los otros docs para aprovechar el sistema completo.
