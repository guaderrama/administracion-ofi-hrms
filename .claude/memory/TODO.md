# TODO List

> Mantén esta lista actualizada al final de cada sesión

---

## 🔥 High Priority (Esta Semana)

- [ ] Implementar autenticación básica
  - Login con email/password
  - Registro de usuarios
  - Verificación de email
- [ ] Configurar base de datos
  - Crear schema inicial
  - Setup de migrations
  - Seed data
- [ ] Setup de CI/CD
  - GitHub Actions
  - Linting pipeline
  - Tests automáticos

---

## 📋 Medium Priority (Este Mes)

- [ ] Agregar tests unitarios
  - Components tests
  - API endpoints tests
  - Integration tests
- [ ] Documentar API endpoints
  - OpenAPI spec
  - Ejemplos de uso
  - Error codes
- [ ] Implementar rate limiting
  - Por IP
  - Por API key
  - Redis cache

---

## 💡 Low Priority (Backlog)

- [ ] Optimizar performance
  - Code splitting
  - Image optimization
  - Lazy loading
- [ ] Agregar analytics
  - Google Analytics
  - Event tracking
  - User behavior
- [ ] Implementar i18n
  - Spanish
  - English
  - French

---

## ✅ Completed (Esta Semana)

- [x] Setup inicial del proyecto
  - Completado: 2025-11-03
- [x] Configuración de .claude/
  - Completado: 2025-11-03
- [x] Instalación de dependencias
  - Completado: 2025-11-03

---

## 🗑️ Archive (Completados Anteriores)

<details>
<summary>Semana del 2025-10-27</summary>

- [x] Investigar frameworks
- [x] Comparar Next.js vs Remix
- [x] Decidir stack tecnológico
</details>

---

## How to Use

### Agregar Nueva Tarea
```markdown
- [ ] Descripción de la tarea
  - Subtarea 1
  - Subtarea 2
```

### Marcar Completada
```markdown
- [x] Tarea completada
  - Completado: YYYY-MM-DD
```

### Mover a Prioridad
Si una tarea se vuelve urgente, muévela a High Priority.

### Archivar
Al final de cada semana:
1. Mueve completadas a "Completed (Esta Semana)"
2. Al final del mes, mueve a "Archive"

---

## Tips

- ✅ Revisa esta lista al inicio de cada sesión
- ✅ Actualiza después de completar tareas
- ✅ Divide tareas grandes en subtareas
- ✅ Sé específico en las descripciones
- ✅ Incluye criterios de aceptación
- ✅ Estima tiempos si es útil

---

## Dile a Claude

Al inicio de sesión:
```
Lee .claude/memory/TODO.md y ayúdame con la tarea de mayor prioridad
```

Para actualizar:
```
Actualiza .claude/memory/TODO.md:
- Marca [tarea X] como completada
- Agrega nueva tarea: [descripción]
```
