# Git Workflow Guide

Esta guía cubre tanto las convenciones generales de Git como las instrucciones operacionales para Claude Code.

---

## 🤖 Instrucciones para Claude Code

**Modo:** Autonomía guiada. Pregunta solo si falta información importante o si hay riesgo de perder trabajo.

**Reglas base:**
1. Nunca hagas push directo a `main` o `develop`
2. Ejecuta todos los comandos en la raíz del repositorio
3. Si el proyecto no es Node, adapta los comandos de tests al stack correcto

### Verificación Inicial (Silenciosa)

Antes de cualquier operación Git, verifica:

```bash
git --version
gh --version
gh auth status
```

Si algo falta o falla, detente y avisa al usuario.

---

## 🌿 Branch Strategy

### Branch Types

| Branch | Propósito | Merge a |
|--------|-----------|---------|
| `main` | Production-ready (estable, testeado) | — |
| `develop` | Integration branch (pre-release) | `main` |
| `feature/` | Desarrollo de features | `develop` |
| `bugfix/` | Corrección de bugs | `develop` |
| `hotfix/` | Fixes urgentes en producción | `main` y `develop` |

### Naming Convention

```
feature/TICKET-123-description
bugfix/TICKET-456-description
hotfix/TICKET-789-description
```

**Ejemplos:**
```
feature/VIDEO-001-video-upload
bugfix/AUTH-045-fix-token-expiry
hotfix/PAY-099-payment-critical-fix
```

---

## 📝 Conventional Commits

### Formato

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Documentación |
| `style` | Formato (no afecta código) |
| `refactor` | Refactoring sin cambio de funcionalidad |
| `perf` | Mejoras de performance |
| `test` | Tests |
| `chore` | Build, dependencies, mantenimiento |

### Ejemplos

```bash
git commit -m "feat(auth): add OAuth2 integration"
git commit -m "fix(video-editor): handle null canvas reference"
git commit -m "docs(readme): update installation instructions"
git commit -m "refactor(store): simplify state management"
git commit -m "test(components): add Button component tests"
```

---

## 🚀 SECCIÓN A — GIT_INIT: Proyecto Nuevo

Usa este flujo cuando el proyecto aún no está en GitHub.

### Datos Requeridos

| Campo | Descripción |
|-------|-------------|
| **Nombre repo** | nombre-del-repo en GitHub |
| **Descripción** | 1 frase corta |
| **Visibilidad** | `public` o `private` |

### Paso A1 — Inicializar Repo Local

Si NO existe carpeta `.git`:

```bash
git init
git branch -M main
```

Verificar o crear `.gitignore`:
- Si no existe, usar template de `.claude/snippets/gitignore.txt`
- Mínimo incluir: `node_modules`, `.env`, `.env*.local`, `dist`, `.DS_Store`, `*.log`

### Paso A2 — Primer Commit

```bash
git add -A
git commit -m "chore: initial commit"
```

Si no hay nada que commitear, avisar y detenerse.

### Paso A3 — Crear Repo en GitHub

Verificar si ya existe remoto:

```bash
git remote -v
```

- Si ya hay `origin` → usar ese remoto
- Si NO existe `origin`:

```bash
gh repo create <nombre-repo> --<public|private> --source=. --remote=origin --description "<descripción>"
```

### Paso A4 — Push Inicial

```bash
git push -u origin main
```

### Paso A5 — Confirmar

```bash
gh repo view --web
```

Mostrar URL del repo y confirmar que el commit está en `main`.

### Seguridad en GIT_INIT

- ❌ Nunca incluir `.env`, llaves o archivos sensibles
- ⚠️ Si detectas posibles secretos, detente y avisa ANTES de push

---

## 🔄 SECCIÓN B — GIT_UPDATE: Cambios en Repo Existente

Usa este flujo cuando el repo ya existe y se necesitan hacer cambios.

### Datos Requeridos

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Tarea** | Qué cambiar (1-2 frases) | Agregar validación de email |
| **Rama** | Nombre de la rama | `feature/AUTH-001-email-validation` |
| **Commit** | Mensaje del commit | `feat(auth): add email validation` |
| **PR** | Resumen para el PR | Implementa validación de formato de email |

**Formato rápido:**
```
Tarea: <...> | Rama: feature/<...> | Commit: feat(...): <...> | PR: <resumen>
```

### Paso B0 — Confirmación Inicial

1. Resumir en 1-2 líneas el plan
2. Preguntar: **"¿Ejecuto este flujo de UPDATE ahora? (sí/no)"**
3. Si "sí" → ejecutar todo sin pedir permiso en cada paso
4. Pausar SOLO si: falta dato, hay error, o riesgo de pisar trabajo

### Paso B1 — Preflight Seguro

```bash
git status
git config user.name && git config user.email
```

Si hay cambios sin commitear:

```bash
git stash push -u -m "claude: pre-update"
```

Sincronizar rama base:

```bash
git fetch --prune
git checkout develop
git pull --ff-only origin develop
```

### Paso B2 — Rama de Trabajo

**Si la rama ya existe:**

```bash
git checkout <rama>
git pull --ff-only origin <rama>
```

**Si la rama NO existe:**

```bash
git checkout -b <rama>
```

Si usaste stash:

```bash
git stash pop
```

### Paso B3 — Aplicar la Tarea

1. Hacer los cambios de código solicitados
2. Si se modificó `package.json` o `package-lock.json`:

```bash
npm install
```

### Paso B4 — Calidad Local

```bash
npm run test
npm run lint:fix
npm run typecheck
```

- Si los tests fallan → ❌ NO hacer push
- Mostrar errores y proponer correcciones
- Repetir hasta que pasen

**Si NO es proyecto Node:** Adaptar comandos al stack del proyecto.

### Paso B5 — Commit y Push

```bash
git add -A
git commit -m "<mensaje-commit>"
git push -u origin <rama>
```

### Paso B6 — Crear Pull Request

**Si no existe PR:**

```bash
gh pr create --base develop --title "<mensaje-commit>" --body "<resumen PR>"
```

**Si ya existe PR:** El push lo actualiza automáticamente.

**PR Checklist:**
- [ ] Tests pasan localmente
- [ ] Sin errores de linting
- [ ] Sin errores de TypeScript
- [ ] Documentación actualizada si aplica
- [ ] Sigue guías de estilo

### Paso B7 — Ciclo de Revisión

Si hay comentarios o checks en rojo:

```bash
# Aplicar cambios sugeridos
npm run test
npm run lint:fix
git add -A
git commit -m "fix: address review comments"
git push
```

Repetir hasta checks verdes ✓

### Paso B8 — Mantener Rama al Día

Si el PR está desactualizado:

```bash
git fetch origin
git rebase origin/develop
```

Si hay conflictos:

```bash
# Resolver archivos manualmente
git add <archivos-resueltos>
git rebase --continue
git push --force-with-lease
```

### Paso B9 — Merge Seguro

Cuando todo esté verde y aprobado:

```bash
gh pr merge --squash --delete-branch
git checkout develop
git pull origin develop
```

### Seguridad en GIT_UPDATE

- ❌ Nunca subir `.env`, llaves, `serviceAccount*.json`
- ❌ No modificar `.github/workflows` sin permiso explícito
- ⚠️ Si detectas secretos, detente y avisa

---

## 🔧 Common Scenarios

### Updating Your Branch with Latest Changes

```bash
git fetch origin
git rebase origin/develop
# o alternativamente:
git merge origin/develop
```

### Resolving Conflicts

```bash
# Ver archivos con conflictos
git status

# Resolver en editor, luego:
git add .
git commit -m "merge: resolve conflicts with develop"
git push origin <rama>
```

### Undoing Changes

```bash
# Deshacer último commit (mantener cambios)
git reset --soft HEAD~1

# Deshacer último commit (descartar cambios)
git reset --hard HEAD~1

# Deshacer archivo específico
git checkout HEAD -- src/path/to/file.ts
```

### Stashing Work

```bash
# Guardar cambios temporalmente
git stash push -u -m "WIP: descripción"

# Ver stashes
git stash list

# Recuperar último stash
git stash pop

# Recuperar stash específico
git stash pop stash@{2}
```

---

## ✅ Best Practices

1. **Commits pequeños y enfocados** — Cada commit = un cambio lógico
2. **Mensajes descriptivos** — Claro qué y por qué
3. **No commitear trabajo incompleto** — Tests deben pasar antes de push
4. **Revisar tu propio código** — Check diffs antes de crear PR
5. **Ramas de vida corta** — Merge en 1-2 semanas máximo
6. **No reescribir historia pública** — Evitar force push a ramas compartidas
7. **Usar ramas para aislamiento** — Cada feature en su propia rama

---

## 📚 Useful Git Commands

```bash
# Ver historial de commits
git log --oneline -10

# Ver cambios no staged
git diff

# Ver cambios staged
git diff --cached

# Ver info de ramas
git branch -v

# Buscar en commits
git log --grep="keyword"

# Ver quién cambió qué
git blame src/path/to/file.ts

# Ver estado limpio
git status -s
```

---

## ⚡ Quick Reference

### Nuevo Feature (Comando Rápido)

```bash
git checkout develop && git pull && git checkout -b feature/TICKET-123-description
```

### Ciclo Completo

```bash
# 1. Crear rama
git checkout develop && git pull
git checkout -b feature/TICKET-123-description

# 2. Desarrollar y commitear
git add .
git commit -m "feat(scope): description"

# 3. Push
git push origin feature/TICKET-123-description

# 4. Crear PR en GitHub o con gh cli
gh pr create --base develop --title "feat(scope): description"

# 5. Después del merge
git checkout develop && git pull
```

### Formato Rápido para Claude

```
Tarea: <...> | Rama: feature/<...> | Commit: feat(...): <...> | PR: <resumen>
```

---

## 🔗 Referencias

- Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para estándares de código
- Ver [WORKFLOW.md](./WORKFLOW.md) para proceso PLAN → DIFFS → VERIFY
- Ver `.claude/snippets/gitignore.txt` para template de .gitignore

---

*Esta guía es la fuente de verdad para operaciones Git en este proyecto.*
