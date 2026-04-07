# Instrucciones: Agregar UI/UX Pro 2026 a Este Proyecto

**Copia este archivo a la raíz de tu proyecto existente y dile a Claude:**
```
Lee AGREGAR_UI_UX_PRO.md y ejecuta todas las instrucciones paso a paso.
```

---

## Reglas Importantes

- **NO borres** nada que ya exista en el proyecto
- **NO sobrescribas** archivos existentes
- **Solo AGREGA** lo que falta
- **Haz MERGE** en archivos que ya existen (CLAUDE.md, INDEX.md, mcp.json)
- **Preserva** todo el contenido personalizado del proyecto
- Antes de empezar, haz `git status` para verificar que no hay cambios sin commitear

---

## Paso 1: Clonar ui-ux-pro-max-skill

Si NO existe `.claude/skills/ui-ux-pro-max-skill/`:

```bash
mkdir -p .claude/skills
cd .claude/skills
git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git
cd ../..
```

Si ya existe, saltar este paso.

---

## Paso 2: Agregar sección Frontend Aesthetics a CLAUDE.md

Busca en CLAUDE.md la sección de "Tech Stack" o "Architecture" (o similar).
**Después de esa sección**, agrega el siguiente bloque COMPLETO.
**NO borres nada que ya exista en el CLAUDE.md.**

```markdown
## 🎨 Frontend Aesthetics & UI/UX Guidelines

### Design Philosophy: Evita "AI Slop Aesthetic"

**PROHIBIDO (Generic AI Look):**
- ❌ Inter/Roboto fonts everywhere
- ❌ Purple/blue gradients by default
- ❌ Rounded corners on everything (border-radius: 12px)
- ❌ Glass morphism effects without purpose
- ❌ Generic hero sections with stock illustrations
- ❌ Particle.js backgrounds
- ❌ Excessive drop shadows and glows
- ❌ Cookie-cutter dashboard layouts

**REQUERIDO (Professional Design):**
- ✅ Typography system with personality (Geist, Inter Display, custom fonts)
- ✅ Purposeful color palettes (brand-aligned, accessibility-first)
- ✅ Intentional spacing system (4px, 8px, 16px, 24px, 32px, 48px, 64px)
- ✅ Micro-interactions and purposeful animations
- ✅ Context-aware component variants
- ✅ Data visualization with clear hierarchy
- ✅ Responsive design with mobile-first approach
- ✅ Dark mode that's actually designed (not just inverted colors)

### UI Component Hierarchy

**shadcn/ui Integration**
- Use shadcn MCP para instalación automática de componentes
- Customize components siguiendo design system
- Mantén components en `src/shared/components/ui/`

**Component Categories:**

Primitive components (shadcn base) → src/shared/components/ui/
Composed components (custom) → src/shared/components/
Feature-specific components → src/features/[feature]/components/

### Design System Tokens

**Colors (Semantic Naming)**
- Usar nombres semánticos: primary, success, warning, error, neutral
- NO usar nombres de color: blue500, purple400, etc.

**Typography Scale**
- Usar tokens de design system: text-display-lg, font-display
- NO usar valores arbitrarios: text-4xl font-bold

### Animation Guidelines

**Purposeful Motion**
- transition-base: 150ms ease-in-out
- transition-slow: 300ms ease-in-out
- transition-slower: 500ms ease-in-out
- NO usar duraciones arbitrarias (duration-500)

### Accessibility Requirements

**Always Include:**
- ✅ ARIA labels on interactive elements
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Focus indicators (visible focus rings)
- ✅ Color contrast ratio ≥ 4.5:1 (WCAG AA)
- ✅ Alt text on images
- ✅ Semantic HTML (header, nav, main, footer, article, section)

### Dashboard Design Patterns

**Layout Patterns:**
- Grid-based layouts (CSS Grid preferred over flexbox for complex layouts)
- Sticky headers and sidebars
- Progressive disclosure (show details on demand)
- Empty states with clear CTAs
- Loading states with skeleton screens

### UI/UX Skill Integration

**Available via ui-ux-pro-max-skill:**
- 67 UI component styles
- 10 complete dashboard templates
- 96 professional color palettes
- 25 chart and visualization types
- 100+ design reasoning rules

### Visual QA Checklist

Antes de considerar UI completo, verificar:
- [ ] Spacing consistente (no valores arbitrarios)
- [ ] Typography scale aplicado correctamente
- [ ] Color palette semántico (no hardcoded hex)
- [ ] Responsive breakpoints tested (mobile, tablet, desktop)
- [ ] Dark mode funciona correctamente
- [ ] Animations son purposeful (no distracting)
- [ ] Accessibility: keyboard nav + ARIA labels
- [ ] Loading states y error states implementados
- [ ] No generic AI aesthetic (fonts, gradients, borders)

### Playwright MCP Integration for Visual Testing

**Viewport Testing:**
- Mobile: 375px, 414px
- Tablet: 768px, 1024px
- Desktop: 1280px, 1440px, 1920px
```

---

## Paso 3: Crear archivo de prompts UI/UX

Si NO existe `.claude/prompts/`, crear el directorio.
Si NO existe `.claude/prompts/ui-design-starter.md`, crear con este contenido:

```markdown
# UI/UX Design Starter Prompts

## Dashboard Generation
Usa ui-ux-pro-max-skill para generar un dashboard profesional para [INDUSTRIA].
- Tipo: [Analytics / E-commerce / SaaS / Finance / Healthcare]
- Key metrics: [3-5 métricas principales]
- Color palette: [profesional, no purple gradients]
- Charts: [tipos de visualización necesarios]
- Layout: [sidebar navigation / top nav / hybrid]
- Evita: Generic AI aesthetic
- Incluye: Responsive design, dark mode, accessibility

## Component Creation (shadcn)
Necesito crear [COMPONENTE] usando shadcn/ui.
- Base component: [button / card / form / table / dialog]
- Variants: [primary, secondary, etc.]
- States: [default, hover, focus, disabled, loading]
- Dark mode: yes
- Accessibility: WCAG AA compliance

## Color Palette Selection
Genera color palette profesional para proyecto [TIPO].
- Industria: [fintech / healthcare / e-commerce / etc.]
- Usa ui-ux-pro-max-skill (96 palettes disponibles)
- Incluye: Primary, secondary, accent, semantic colors, neutral scale, dark mode

## Complete Design System
Genera design system completo:
1. Color palette (primary, secondary, neutrals, semantic)
2. Typography scale (headings, body, captions)
3. Spacing system (4px base scale)
4. Component variants (button, input, card, etc.)
5. Animation/transition standards
6. Grid system and breakpoints
Output: tailwind.config.ts + component examples

## Anti-Pattern: NO usar prompts genéricos
❌ "Create a beautiful dashboard with charts"
✅ "Usa ui-ux-pro-max-skill para generar dashboard de analytics SaaS.
    Color palette: profesional (no purple), neutros oscuros + accent teal.
    Charts: line chart (revenue), bar chart (users), pie chart (sources).
    Layout: sidebar nav, responsive, dark mode.
    Evita: Inter font, glass morphism, generic gradients."
```

---

## Paso 4: Actualizar mcp.json

Si NO existe `mcp.json`, crearlo con esta configuración.
Si YA existe, **agregar solo los MCPs que faltan** sin borrar los existentes:

```json
{
  "mcpServers": {
    "shadcn": {
      "disabled": false,
      "autoApprove": ["install_component", "search_components"],
      "command": "npx",
      "args": ["-y", "shadcn@latest", "mcp"]
    }
  }
}
```

**MCPs recomendados adicionales** (agregar solo si no existen):
- `playwright` - para testing visual
- `chrome-devtools` - para debug de navegador
- `github` - para gestión de repos

**Regla importante:** Mantener máximo 4 MCPs activos para no desperdiciar tokens.
Si el proyecto ya tiene más de 4 MCPs activos, sugerir cuáles desactivar con `"disabled": true`.

---

## Paso 5: Actualizar INDEX.md (si existe)

Si existe `.claude/INDEX.md`, agregar en la sección de Skills:

```markdown
### UI/UX & Design
- **ui-ux-pro-max-skill** - Professional UI/UX design system (25,300+ stars)
  - 67 UI component styles, 10 dashboard templates, 96 color palettes
- **prompts/ui-design-starter.md** - UI/UX starter prompts
```

Si no existe INDEX.md, saltar este paso.

---

## Paso 6: Verificación Final

Ejecutar estos checks:

1. Verificar que existe `.claude/skills/ui-ux-pro-max-skill/`
2. Verificar que CLAUDE.md contiene "Frontend Aesthetics"
3. Verificar que existe `.claude/prompts/ui-design-starter.md`
4. Verificar que mcp.json contiene "shadcn"
5. Contar MCPs activos (debe ser ≤ 4)

Mostrar resumen de lo que se agregó y lo que ya existía.

---

## Después de Ejecutar

Puedes probar el skill con:

```
Usa ui-ux-pro-max-skill para generar un dashboard profesional.
Color palette: profesional (no purple), neutros + accent teal.
Charts: line chart, bar chart, pie chart.
Layout: sidebar navigation, responsive, dark mode.
Evita: AI slop aesthetic.
```

---

**RECUERDA: Este archivo (AGREGAR_UI_UX_PRO.md) puedes eliminarlo después de ejecutar las instrucciones. Es solo una guía de ejecución.**
