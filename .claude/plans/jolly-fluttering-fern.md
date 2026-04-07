# Plan: Mejora UI/UX Completa - HRMS

## Contexto
La app funciona bien pero el UI/UX tiene gaps: usa `alert()` para feedback (47 llamadas), no tiene loading skeletons, accesibilidad minima (solo 3 atributos ARIA en toda la app), colores hardcodeados, y patrones de glassmorphism repetidos sin componente reutilizable. Se aplican las guias del UI/UX Pro Max Skill con Tailwind puro (sin shadcn/ui).

---

## Fase 1: Fundacion (Tokens + Componentes Compartidos)

### 1.1 Design tokens en `index.html`
- Expandir `tailwind.config` inline con colores semanticos: `brand`, `accent`, `success`, `warning`, `error`, `info`
- Agregar animaciones: `fade-in`, `slide-in-up`, `toast-in`, `toast-out`, `skeleton`
- Agregar CSS: `focus-visible` outline global (amber), skip-link

### 1.2 Crear `index.css` (archivo referenciado pero no existe)
- Skeleton loading animation background
- Page enter animation
- Screen reader utility class

### 1.3 Crear componentes UI reutilizables (8 archivos nuevos en `components/ui/`)

| Componente | Proposito | Reemplaza |
|---|---|---|
| `Toast.tsx` (~180 lineas) | Sistema de notificaciones con context/provider | 47 `alert()` + 11 `window.confirm()` |
| `ConfirmDialog.tsx` (~100 lineas) | Modal de confirmacion accesible | `window.confirm()` |
| `Skeleton.tsx` (~80 lineas) | Skeleton loaders (tabla, card, dashboard) | Sin loading states |
| `LoadingSpinner.tsx` (~30 lineas) | Spinner consistente con sizes | Spinners inline adhoc |
| `EmptyState.tsx` (~40 lineas) | Estado vacio con icono + mensaje | 8+ mensajes adhoc |
| `StatusBadge.tsx` (~35 lineas) | Badges de estado (success/error/warning) | Badges inline repetidos |
| `Card.tsx` (~40 lineas) | Card glassmorphism reutilizable | Patron repetido 31 veces |
| `ErrorBoundary.tsx` (~60 lineas) | Error boundary para crashes | Pantalla blanca sin info |
| `AccessDenied.tsx` (~30 lineas) | Pantalla acceso denegado | Bloques duplicados en 3 paginas |
| `index.ts` | Barrel export | - |

### 1.4 Conectar en `index.tsx`
- Envolver App con `<ToastProvider>` y `<ErrorBoundary>`

---

## Fase 2: Mejoras por Pagina

### 2.1 `App.tsx` (~15 cambios)
- Reemplazar spinner inline con `<LoadingSpinner>`
- Agregar skip-to-content link
- `id="main-content"` y `role="main"` en `<main>`
- Wrap `renderView()` con `<ErrorBoundary>` + animacion `page-enter`

### 2.2 `LoginPage.tsx` (~45 cambios)
- ARIA: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-required`
- Reemplazar spinners inline con `<LoadingSpinner>`
- Mejorar display de errores con `role="alert"` y `aria-live="assertive"`
- Auto-focus en email input
- **Mantener** paleta azul/purpura (distincion intencional del auth flow)

### 2.3 `Sidebar.tsx` (~25 cambios)
- Cambiar `<div>` a `<aside>` + `<nav role="navigation" aria-label="Menu principal">`
- `aria-expanded` en secciones accordion
- Reemplazar `bg-[#4A3728]` con `bg-brand-900`
- Cambiar `<a href="#">` a `<button>` (semantica correcta)
- Animacion suave en accordion con `max-height` transition

### 2.4 `DashboardPage.tsx` (~20 cambios)
- Usar `<Card>` componente compartido
- Usar `<EmptyState>` para estados vacios
- Semantic HTML con `<section aria-label>`
- Hover animation en cards

### 2.5 `NominasPage.tsx` (~35 cambios)
- Usar `<Card>`, `<StatusBadge>`, `<EmptyState>`, `<TableSkeleton>`
- `<caption>` en tabla (sr-only)
- `scope="col"` en `<th>` elements
- Micro-interaccion `active:scale-[0.98]` en botones
- Usar `<AccessDenied>` para bloques de acceso denegado

### 2.6 `ChecadorPage.tsx` (~40 cambios)
- Reemplazar 7 `alert()` con `useToast()`
- Reemplazar `window.confirm()` con `<ConfirmDialog>`
- `role="dialog"` y `aria-modal="true"` en modal de edicion
- `aria-label` en botones de icono

### 2.7 `VacationForm.tsx` (~25 cambios)
- Reemplazar 4 `alert()` con `useToast()`
- Usar `<StatusBadge>` para "Encontrado"/"No encontrado"
- Usar `<Card>` para las 4 secciones
- `aria-invalid="true"` cuando dias < 0

### 2.8 `AdminPage.tsx` (~15 cambios)
- Usar `<AccessDenied>` (reduce de 58 a ~20 lineas)

### 2.9 `AdminView.tsx` (~60 cambios)
- Reemplazar ~30 `alert()` con `useToast()`
- Reemplazar ~7 `window.confirm()` con `<ConfirmDialog>`
- `aria-label` en botones de icono, `scope="col"` en tablas
- **NO refactorizar** estructura (archivo grande, solo cambios seguros)

### 2.10 `MobileHeader.tsx` (~3 cambios)
- `bg-[#4A3728]` -> `bg-brand-900`
- `role="banner"` en header

### 2.11 Sub-componentes Checador (~30 cambios total en 5 archivos)
- LogTable, IncomeTable, IncomeForm, ActionButtons, EmployeeSelector
- Accesibilidad en tablas, reemplazar alert(), EmptyState

---

## Que NO se toca
- Logica de negocio (calculos, Firebase, auth)
- `src/contexts/AuthContext.tsx`
- `src/services/firestoreService.ts`
- `types.ts`, `constants.ts`
- Generacion de PDFs (PermissionGenerator, VacationSlip, LoanRequest, NominasPdfPreview)
- `utils/vacationCalculator.ts`
- Paleta azul/purpura del LoginPage

---

## Resumen de Archivos

**Nuevos (11 archivos, ~630 lineas):**
- `components/ui/Toast.tsx`, `ConfirmDialog.tsx`, `Skeleton.tsx`, `LoadingSpinner.tsx`
- `components/ui/EmptyState.tsx`, `StatusBadge.tsx`, `Card.tsx`, `ErrorBoundary.tsx`
- `components/ui/AccessDenied.tsx`, `index.ts`
- `index.css`

**Modificados (14 archivos, ~400 lineas cambiadas):**
- `index.html`, `index.tsx`, `App.tsx`, `LoginPage.tsx`, `Sidebar.tsx`
- `DashboardPage.tsx`, `NominasPage.tsx`, `ChecadorPage.tsx`, `VacationForm.tsx`
- `AdminPage.tsx`, `AdminView.tsx`, `MobileHeader.tsx`
- Sub-componentes checador (LogTable, IncomeTable, IncomeForm)

---

## Verificacion
1. `npm run build` sin errores
2. Todas las paginas cargan correctamente
3. Toasts aparecen en lugar de alert()
4. Skeletons se muestran durante carga
5. Tab navigation funciona en sidebar y formularios
6. Cards tienen hover effect consistente
7. No se rompio ninguna funcionalidad existente
