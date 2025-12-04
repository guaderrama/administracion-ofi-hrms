# Blockers

> Problemas que impiden avanzar. Documenta intentos de solución y estado actual.

---

## 🚨 Active Blockers (URGENTE)

### [Ninguno actualmente]

---

## ⚠️ In Progress (Investigando)

### [Ninguno actualmente]

---

## ✅ Resolved

### [Ninguno aún]

---

## Template para Nuevos Blockers

```markdown
### [Título del Blocker]

**Fecha reportado:** YYYY-MM-DD
**Severidad:** 🔴 Critical | 🟡 High | 🟢 Medium
**Impacta a:** [Qué feature/funcionalidad bloquea]

**Problema:**
[Descripción clara del problema]

**Reproduce:**
1. Paso 1
2. Paso 2
3. Error ocurre

**Error message:**
```
[Pegar mensaje de error completo]
```

**Intentos de solución:**
- [ ] Intento 1: [Resultado]
- [ ] Intento 2: [Resultado]
- [ ] Intento 3: [Resultado]

**Siguiente paso:**
[Qué vamos a intentar ahora]

**Workaround temporal:**
[Si hay forma de evitar el problema temporalmente]

**Recursos:**
- Link 1: [Documentation relevante]
- Link 2: [GitHub issue similar]
- Link 3: [Stack Overflow]

**Assigned to:** [Persona trabajando en esto]
**Status:** 🔴 Blocked | 🟡 Investigating | 🟢 Has Workaround
```

---

## Example: Resolved Blocker

### API de Stripe no responde en desarrollo local

**Fecha reportado:** 2025-11-02  
**Fecha resuelto:** 2025-11-03  
**Severidad:** 🟡 High  
**Impacta a:** Payment flow, testing de checkout

**Problema:**
Al hacer request a Stripe API desde localhost, obtenemos CORS error. Producción funciona bien.

**Reproduce:**
1. `npm run dev`
2. Ir a `/checkout`
3. Click en "Pay with Stripe"
4. Error: "CORS policy blocked"

**Error message:**
```
Access to fetch at 'https://api.stripe.com' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**Intentos de solución:**
- [x] Intenté agregar headers en request: No funcionó
- [x] Revisé Stripe dashboard settings: Todo correcto
- [x] Busqué en docs de Stripe: Encontré la solución

**Solución:**
Stripe API debe ser llamada desde el backend, no desde el cliente. 
Movimos la llamada a un API route de Next.js:
- Creamos `/api/create-payment-intent`
- Cliente llama a nuestra API
- Nuestro backend llama a Stripe
- CORS resuelto

**Lección aprendida:**
APIs de pago SIEMPRE deben llamarse desde backend por seguridad y CORS.

**Commit:** abc123f

---

## Example: Blocker Con Workaround

### Puerto 3000 ocupado al iniciar desarrollo

**Fecha reportado:** 2025-10-30  
**Severidad:** 🟢 Medium  
**Impacta a:** Developer experience, no critical

**Problema:**
Al correr `npm run dev`, dice "Port 3000 already in use".

**Reproduce:**
1. Tener otra app corriendo en 3000
2. `npm run dev`
3. Error

**Intentos de solución:**
- [x] Matar proceso manualmente: Funciona pero tedioso
- [x] Cambiar puerto en package.json: Funciona pero inconsistente
- [ ] Auto-detect puerto libre: Investigando

**Workaround temporal:**
```bash
# Matar proceso en puerto 3000
lsof -ti:3000 | xargs kill -9

# O usar puerto diferente
npm run dev -- --port 3001
```

**Siguiente paso:**
Implementar auto-detection de puerto en dev script.

**Status:** 🟢 Has Workaround

---

## How to Use

### Al encontrar un blocker:
1. Documenta inmediatamente
2. Usa el template
3. Incluye TODOS los detalles
4. Anota intentos de solución
5. Actualiza status frecuentemente

### Qué documentar:
- ✅ Problemas que detienen desarrollo por >30 min
- ✅ Bugs críticos de producción
- ✅ Dependencias bloqueadas
- ✅ Issues con terceros (APIs, servicios)
- ❌ Bugs normales (usa issue tracker)

### Severity Guide:
- 🔴 **Critical:** Producción caída, no se puede deployar
- 🟡 **High:** Feature bloqueada, no hay workaround
- 🟢 **Medium:** Hay workaround, inconveniente pero no crítico

### Resolver un blocker:
1. Muévelo a "Resolved"
2. Documenta la solución
3. Incluye lección aprendida
4. Referencia commit si aplica

---

## Tips

- ✅ Documenta mientras investigas, no después
- ✅ Incluye comandos exactos y outputs completos
- ✅ Links a recursos útiles
- ✅ Screenshots si ayudan
- ✅ Stack traces completos
- ✅ Versiones de dependencias relevantes

---

## Dile a Claude

Para ayuda con blocker:
```
Lee .claude/memory/BLOCKERS.md y ayúdame a resolver [blocker X]
```

Para documentar nuevo:
```
Ayúdame a documentar este blocker en BLOCKERS.md:
[descripción del problema]
```

Para actualizar status:
```
Actualiza status de [blocker X] en BLOCKERS.md: [nueva info]
```
