# Task 0001: [Título de la Tarea]

> Template para documentar tareas complejas o features. Copia este archivo y renombra como 0002-nombre-tarea.md

---

## Status

**Current:** 🆕 Not Started | 🚧 In Progress | ✅ Completed | ❌ Blocked | ⏸️ Paused

---

## Priority

**Level:** 🔥 Critical | 🟡 High | 📋 Medium | 💡 Low

---

## Metadata

- **Created:** YYYY-MM-DD
- **Started:** YYYY-MM-DD
- **Completed:** YYYY-MM-DD
- **Estimated time:** X hours/days
- **Actual time:** X hours/days
- **Assigned to:** [Nombre]
- **Related to:** [Links a otras tasks, issues, PRs]

---

## Objective

[Descripción clara y concisa de qué se quiere lograr]

**Success Criteria:**
- [ ] Criterio 1
- [ ] Criterio 2
- [ ] Criterio 3

---

## Context & Background

[Por qué es necesaria esta tarea. Contexto del negocio o técnico.]

**User Story (si aplica):**
```
As a [tipo de usuario]
I want to [acción]
So that [beneficio]
```

---

## Plan

### Phase 1: [Nombre de Fase]
- [ ] Subtarea 1.1
- [ ] Subtarea 1.2
- [ ] Subtarea 1.3

### Phase 2: [Nombre de Fase]
- [ ] Subtarea 2.1
- [ ] Subtarea 2.2
- [ ] Subtarea 2.3

### Phase 3: [Nombre de Fase]
- [ ] Subtarea 3.1
- [ ] Subtarea 3.2
- [ ] Subtarea 3.3

---

## Technical Details

**Affected Files:**
- `path/to/file1.ts`
- `path/to/file2.tsx`
- `path/to/file3.css`

**Dependencies:**
- Package 1
- Package 2
- Service 3

**APIs/Services:**
- API endpoint 1
- External service 2

**Database Changes:**
- [ ] New table: `table_name`
- [ ] Migration: `YYYY-MM-DD-description.sql`
- [ ] Seed data required

---

## Implementation Notes

### Architecture Decisions
[Decisiones técnicas importantes para esta tarea]

### Design Patterns Used
[Patrones que se aplican]

### Edge Cases
- Edge case 1: [Cómo se maneja]
- Edge case 2: [Cómo se maneja]

### Performance Considerations
[Optimizaciones o consideraciones de performance]

### Security Considerations
[Validaciones, sanitización, auth, etc.]

---

## Testing Strategy

### Unit Tests
```bash
npm run test path/to/test
```

**Test Cases:**
- [ ] Happy path
- [ ] Error cases
- [ ] Edge cases
- [ ] Integration tests

### Manual Testing
1. Step 1
2. Step 2
3. Expected result

### QA Checklist
- [ ] Funciona en Chrome
- [ ] Funciona en Firefox
- [ ] Funciona en Safari
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Performance (lighthouse score)

---

## Verification (Commands to Test)

```bash
# Development server
npm run dev
# Should show [expected behavior]

# Run tests
npm run test
# All tests should pass

# Lint
npm run lint
# No errors

# Type check
npm run typecheck
# No errors

# Build
npm run build
# Should succeed without warnings
```

---

## Documentation

**Files to Update:**
- [ ] README.md
- [ ] API documentation
- [ ] Changelog
- [ ] User guide (if needed)

**Comments Added:**
- [ ] JSDoc comments in code
- [ ] Inline comments for complex logic
- [ ] README in feature folder

---

## Rollout Plan

### Prerequisites
- [ ] Prerequisite 1
- [ ] Prerequisite 2

### Deployment Steps
1. Step 1
2. Step 2
3. Step 3

### Rollback Plan
[Cómo revertir si algo sale mal]

### Monitoring
- Metric 1 to watch
- Metric 2 to watch
- Alert conditions

---

## Notes & Learnings

### Day-to-Day Notes
```
YYYY-MM-DD:
- Progress note
- Challenge encountered
- Solution found

YYYY-MM-DD:
- More notes
```

### Challenges Faced
- Challenge 1: [Descripción y solución]
- Challenge 2: [Descripción y solución]

### Lessons Learned
- Lesson 1
- Lesson 2

### Things to Improve Next Time
- Improvement 1
- Improvement 2

---

## Blockers

**Current Blockers:**
- [ ] Blocker 1: [Descripción]
  - Waiting on: [Qué se necesita]
  - Status: [Estado]

**Resolved Blockers:**
- [x] Blocker X: [Cómo se resolvió]

---

## Related Tasks

- Task 0000: [Relacionada antes]
- Task 0002: [Relacionada después]
- Task 0003: [Dependencia]

---

## Resources & References

- [Link 1: Documentation]
- [Link 2: Stack Overflow]
- [Link 3: GitHub issue]
- [Link 4: Design mockup]
- [Link 5: API docs]

---

## Example: Complete Task

# Task 0002: Implement User Authentication

## Status
**Current:** ✅ Completed

## Priority
**Level:** 🔥 Critical

## Metadata
- **Created:** 2025-11-01
- **Started:** 2025-11-02
- **Completed:** 2025-11-04
- **Estimated time:** 2 days
- **Actual time:** 3 days
- **Assigned to:** Dev Team
- **Related to:** #45, PR #67

## Objective
Implement secure authentication system with email/password and social login.

**Success Criteria:**
- [x] Users can register with email
- [x] Users can login/logout
- [x] Sessions persist across refreshes
- [x] Protected routes work correctly
- [x] Google OAuth works

## Plan

### Phase 1: Supabase Setup
- [x] Create Supabase project
- [x] Configure auth providers
- [x] Setup environment variables

### Phase 2: Auth UI
- [x] Create login form
- [x] Create signup form
- [x] Add social login buttons
- [x] Add password reset flow

### Phase 3: Route Protection
- [x] Create auth middleware
- [x] Protect dashboard routes
- [x] Add redirect logic

## Verification

```bash
npm run dev
# Navigate to /login
# Register new user
# Login works
# Dashboard accessible only when logged in
# Logout works
```

## Notes & Learnings

### Lessons Learned
- Supabase auth helpers make Next.js integration very easy
- Always test password reset flow in production mode
- Social auth requires proper redirect URLs configuration

---

## How to Use This Template

1. **Copy this file** → Rename as `000X-your-task.md`
2. **Fill in metadata** at top
3. **Define objective** and success criteria
4. **Break down into phases** with checkboxes
5. **Document as you work** (don't wait until end)
6. **Update status** frequently
7. **Fill learnings** at the end

---

## Tips

- ✅ Be specific in subtasks
- ✅ Include verification commands
- ✅ Document blockers immediately
- ✅ Update daily if long task
- ✅ Link to related resources
- ✅ Fill "Lessons Learned" while fresh
