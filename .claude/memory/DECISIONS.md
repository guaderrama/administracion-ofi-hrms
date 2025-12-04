# Decisions Log

> Documenta decisiones importantes con fecha, razón e impacto. Esto ayuda a mantener contexto y evitar repetir debates.

---

## Template

```markdown
## YYYY-MM-DD: [Título de la Decisión]

**Contexto:** Situación que llevó a esta decisión

**Razón:** Por qué tomamos esta decisión

**Impacto:** Qué afecta en el proyecto

**Alternativas consideradas:**
- Opción A: Por qué no
- Opción B: Por qué no
- Opción C (elegida): Por qué sí

**Trade-offs:** Ventajas y desventajas

**Decidido por:** Nombre/Equipo

**Revisión:** ¿Cuándo revisar esta decisión?
```

---

## Active Decisions

### 2025-11-03: Usar Next.js 16 con App Router

**Contexto:** Necesitamos elegir framework para el proyecto. React es requisito.

**Razón:**
- Server Components por defecto = mejor performance
- Soporte nativo para Streaming
- Routing file-based intuitivo
- Excelente DX con TypeScript
- Gran ecosistema y comunidad

**Impacto:**
- Necesitamos aprender App Router (diferente a Pages Router)
- Algunos packages de terceros pueden no ser compatibles aún
- Mejora significativa en performance vs CSR puro
- SEO mejorado automáticamente

**Alternativas consideradas:**
- **Remix:** Excelente framework pero menor adopción
- **Next.js 14 Pages Router:** Más maduro pero sin Server Components
- **Vite + React Router:** Más ligero pero requiere más configuración
- **Next.js 16 App Router (elegida):** Balance de features y comunidad

**Trade-offs:**
- ✅ Ventajas: Performance, DX, SEO, comunidad
- ⚠️ Desventajas: Curva de aprendizaje, algunos packages incompatibles

**Decidido por:** Lead Developer

**Revisión:** Revisar en 6 meses o si encontramos bloqueadores

---

### 2025-11-03: PostgreSQL con Supabase en lugar de MongoDB

**Contexto:** Necesitamos base de datos. Datos tienen relaciones claras.

**Razón:**
- Datos son relacionales (usuarios → posts → comments)
- Integridad referencial importante
- Supabase ofrece auth + storage + realtime
- Mejor para queries complejas con joins
- SQL es más conocido por el equipo

**Impacto:**
- Necesitamos definir schema explícito
- Migrations requeridas para cambios
- Queries más estructuradas (menos flexibilidad que NoSQL)
- Mejor consistencia de datos
- Supabase CLI facilita desarrollo local

**Alternativas consideradas:**
- **MongoDB:** Flexible pero pierde integridad referencial
- **MySQL:** Bueno pero sin features de Supabase
- **Firebase:** Más caro, vendor lock-in mayor
- **PostgreSQL + Supabase (elegida):** Mejor balance

**Trade-offs:**
- ✅ Ventajas: Integridad, joins, Supabase ecosystem
- ⚠️ Desventajas: Menos flexible, migrations requeridas

**Decidido por:** Team consensus

**Revisión:** Revisar después de primer mes en producción

---

### 2025-11-02: TypeScript en modo strict

**Contexto:** Decidir nivel de strictness de TypeScript.

**Razón:**
- Prevenir bugs en compile-time
- Mejor autocompletado en IDE
- Más fácil refactoring
- Código más mantenible a largo plazo

**Impacto:**
- Desarrollo inicial más lento (tipos para todo)
- Menos bugs en runtime
- Mejor experiencia de desarrollo a mediano plazo
- Documentación implícita en los tipos

**Alternativas consideradas:**
- **JavaScript puro:** Rápido al inicio, caótico después
- **TypeScript no-strict:** Mejor que JS pero sin beneficios completos
- **TypeScript strict (elegida):** Mejor a largo plazo

**Trade-offs:**
- ✅ Ventajas: Menos bugs, mejor DX, refactoring seguro
- ⚠️ Desventajas: Setup inicial más lento

**Decidido por:** Lead Developer

**Revisión:** No revisable, es estándar del proyecto

---

## Archived Decisions

<details>
<summary>Octubre 2025</summary>

### 2025-10-28: Usar pnpm en lugar de npm

**Razón:** Más rápido, menos espacio en disco, better monorepo support

**Impacto:** Todo el equipo debe usar pnpm

**Decidido por:** Team

</details>

---

## How to Use

### Al tomar una decisión importante:
1. Usa el template de arriba
2. Documenta ANTES de implementar
3. Incluye contexto suficiente
4. Lista alternativas consideradas
5. Define cuándo revisar

### Qué documentar:
- ✅ Elección de tecnologías/frameworks
- ✅ Arquitectura y patrones
- ✅ Cambios de API design
- ✅ Políticas de seguridad
- ✅ Procesos de deployment
- ❌ Decisiones triviales o reversibles fácilmente

### Revisar decisiones:
- Agrega recordatorio en calendar
- Revisa si encuentras problemas
- Actualiza con lecciones aprendidas

---

## Tips

- ✅ Documenta el "por qué", no solo el "qué"
- ✅ Incluye alternativas y por qué no se eligieron
- ✅ Sé honesto sobre trade-offs
- ✅ Define criterios de revisión
- ✅ Mantén formato consistente
- ✅ Archiva decisiones viejas pero no las borres

---

## Dile a Claude

Para revisar decisiones:
```
Lee .claude/memory/DECISIONS.md y dame contexto sobre [decisión X]
```

Para documentar nueva:
```
Ayúdame a documentar esta decisión en DECISIONS.md:
[descripción de la decisión]
```
