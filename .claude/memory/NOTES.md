# Session Notes - HRMS "Cerebro Central"

> Contexto entre sesiones de trabajo

## Current Session: 2026-02-06

### 🎯 What we're working on:
- Actualizacion de documentacion (PRD, TODO, LISTA_DE_TAREAS)
- Todos los features del MVP estan completos y desplegados

### 📊 Progress Today:
- [x] Fix de Firestore rules para menu_config (toggles no funcionaban)
- [x] Mejora visual de botones toggle (ON/OFF con colores verde/rojo)
- [x] Actualizacion completa del PRD v2.0
- [x] Actualizacion de LISTA_DE_TAREAS.md
- [x] Actualizacion de TODO.md

### 💡 Decisions Made:
- Menu config se persiste en Firestore coleccion `menu_config`
- Admin siempre ve todas las opciones RH, empleados solo las habilitadas
- Nomina = bonoPuntualidad + bonoObjetivos + apoyoGasolina (sin sueldo base por ahora)
- Vacaciones calculadas segun LFT 2023

### 🚧 Challenges:
- Toggles de menu no funcionaban: primero fue tema visual (iconos muy pequenos), luego Firestore rules faltaban para `menu_config`
- Git push fallo por gh CLI roto, se arreglo reinstalando via nix

### ✅ Completed:
- [x] Nominas page (admin-only, tabla, PDFs)
- [x] Columnas de vacaciones en nominas
- [x] Auto-llenado por codigo en Papeleta de Vacaciones
- [x] Toggle de opciones RH para admin
- [x] Firestore rules para menu_config
- [x] Documentacion actualizada

### 📝 Next Session:
- Verificar toggles funcionan en produccion
- Considerar agregar sueldo base a nomina
- Posibles mejoras: deducciones, historial de vacaciones

---

## Previous Sessions

### 2026-02-05
**Topic:** Mobile responsive, security fixes, PIN removal
**Progress:**
- Diseno responsivo mobile + desktop
- Eliminacion de GEMINI_API_KEY expuesta
- Eliminacion de contrasena hardcodeada
- Proteccion de JSON.parse
- Password reset functionality
- Eliminacion de PIN en checador
- Simplificacion de Firestore indexes
- Cross-device data sync

### 2025-11-03
**Topic:** Setup inicial del proyecto
**Progress:**
- Configuracion sistema .claude/
- Instalacion de dependencias
- Setup de Firebase (Auth, Firestore, Hosting)
- Implementacion de features base (empleados, checador, permisos, vacaciones, prestamos)
- Dashboard con Chart.js
- Deploy inicial a produccion

---

## Key Info

- **URL Produccion:** https://administracion-ofi-hrms.web.app
- **Repo:** https://github.com/guaderrama/administracion-ofi-hrms
- **Branch:** feature/role-based-access
- **Ultimo commit:** 8fa52f5 (fix: add rules for menu_config collection)
- **Estado git:** Clean, up to date with remote
