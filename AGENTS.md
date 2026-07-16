<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — CRM + Facturación ARCA

Guía operativa para agentes. El detalle de producto y planes vive en `docs/`; acá solo lo necesario para no romper el proyecto.

## Producto

Plantilla single-tenant: CRM mínimo + facturación electrónica ARCA (Argentina) + cuenta corriente.

- Un deployment = una empresa emisora.
- MVP: un solo rol **Admin**.
- Flujo núcleo: Cliente → Borrador → Emisión ARCA → CAE → PDF → CC → Pago → Auditoría.

Fuente de verdad funcional: [`docs/PRD.md`](docs/PRD.md).

## Stack

| Capa | Tecnología |
| --- | --- |
| App | Next.js 16 (App Router) + React 19 + TypeScript |
| Estilos | Sass (`src/styles/`, `globals.scss`) |
| Datos | Supabase (PostgreSQL + Storage) vía `@supabase/ssr` |
| Fiscal | Afip SDK (`https://app.afipsdk.com/api/`) solo desde backend |

Comandos:

```bash
npm run dev
npm run build
npm run lint
```

Env: copiar `.env.example` → `.env.local`. Nunca commitear secretos ni exponer keys sin `NEXT_PUBLIC_`.

## Estructura

```text
src/
  app/                 # rutas App Router: (auth), (dashboard)
  features/<dominio>/  # actions / components / services / schemas / types
  lib/supabase/        # browser.ts, server.ts, proxy.ts
  ui/                  # componentes y layout compartidos
  styles/              # tokens, breakpoints, mixins SCSS
docs/
  PRD.md
  ROADMAP-BACKEND.md
  ROADMAP-FRONTEND.md
```

Dominios esperados: `auth`, `clients`, `issuer-profile`, `billing`, `audit` (y los que el PRD/roadmaps indiquen).

Capas: UI → Server Actions / API routes → services → repositories → adapters (Afip SDK, PDF, email, Storage).

## Reglas no negociables

1. **Fiscal solo en backend.** Certificados, claves, tickets WSAA y access token de Afip SDK nunca llegan al frontend.
2. **Saldo solo tras CAE.** Deuda/movimientos solo si ARCA autoriza. Saldo = suma de movimientos; no editar a mano.
3. **Comprobante autorizado = inmutable.** Corrección únicamente vía Nota de Crédito.
4. **Anti-duplicación:** lock + idempotency + unicidad (ambiente + PV + tipo + número). Ante timeout: reconsultar antes de reemitir.
5. **Homologación antes de producción.** Ambiente activo visible en UI.
6. **Auditoría inmutable** para cambios sensibles, emisiones y config fiscal.
7. **Validación y totales server-side** (IVA, elegibilidad de emisión, créditos).
8. **No implementar post-MVP** (roles granulares, multi-empresa operativa, ND, WhatsApp, KPI-heavy, etc.) salvo pedido explícito.

## Convenciones de código

- Imports siempre al tope del archivo (no inline).
- En `switch` sobre uniones/enums: caso `default` con check `never` exhaustivo.
- Preferir Server Actions / API routes para mutaciones sensibles; no writes client-side a tablas con secretos.
- UI y copy del producto en español.
- Ante duda de API Next.js: leer docs en `node_modules/next/dist/docs/` (esta versión no coincide con conocimiento entrenado).

## Docs (no duplicar acá)

| Doc | Usar para |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | Alcance, reglas de negocio, entidades, aceptación |
| [`docs/ROADMAP-BACKEND.md`](docs/ROADMAP-BACKEND.md) | Fases backend, contratos, anti-duplicación, Afip SDK |
| [`docs/ROADMAP-FRONTEND.md`](docs/ROADMAP-FRONTEND.md) | Pantallas, estados UI, consumo de contratos |

Si hay conflicto entre roadmaps y PRD, **prevalece el PRD**.
