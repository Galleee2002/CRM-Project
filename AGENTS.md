<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — CRM + Facturación ARCA

Guía operativa para agentes. El detalle de producto y planes vive en `docs/`; acá solo lo necesario para no romper el proyecto.

Al ingresar al proyecto: leer `.cursor/rules/` (rules `.mdc`) y este archivo antes de actuar. Mantener `AGENTS.md` al día cuando cambien stack, estructura, comandos, env relevantes o reglas operativas.

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
| Auth / Storage | Supabase vía `@supabase/ssr` |
| Datos | Prisma ORM + PostgreSQL (hospedado en Supabase) |
| Fiscal | Afip SDK (`https://app.afipsdk.com/api/`) solo desde backend |

Comandos:

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:seed
npm run admin:create
```

Env: si existe `.env.example`, copiar → `.env` / `.env.local`. Nunca commitear secretos ni exponer keys sin `NEXT_PUBLIC_`. No crear ni regenerar `.env.example` salvo pedido explícito o documentación de una variable nueva ya en uso.

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (cliente y servidor) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon/publishable) para Auth y cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo backend / scripts (`admin:create`); nunca al cliente |
| `DATABASE_URL` | Connection string Prisma (pooler / runtime) |
| `DIRECT_URL` | Connection string directa para migraciones Prisma |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Opcional para `npm run admin:create` |

## Estructura

```text
.cursor/rules/         # rules del agente (leer al ingresar al proyecto)
prisma/                # schema, migraciones y seed
scripts/               # utilidades CLI (create-admin, etc.)
src/
  app/                 # rutas App Router: (auth), (dashboard)
  features/<dominio>/  # actions / components / services / schemas / types
  lib/supabase/        # browser.ts, server.ts, proxy.ts
  lib/prisma.ts        # Prisma Client + adapter pg
  generated/prisma/    # cliente generado (gitignore; `npm run db:generate`)
  ui/                  # componentes y layout compartidos
  styles/              # tokens, breakpoints, mixins SCSS
docs/
  PRD.md
  ROADMAP-BACKEND.md
  ROADMAP-FRONTEND.md
  CONTRATO-FRONTEND.md
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
9. **Prisma obligatorio.** Acceso a datos solo vía Prisma Client. Prohibido SQL crudo (`$queryRaw`, `$executeRaw`, unsafe, DDL/scripts SQL ad hoc) salvo autorización explícita del usuario.
10. **Tests/lint/build solo bajo pedido.** No ejecutar tests, lint, typecheck ni build “por verificación” en cada prompt; solo si el usuario lo pide.

## Convenciones de código

- Imports siempre al tope del archivo (no inline).
- En `switch` sobre uniones/enums: caso `default` con check `never` exhaustivo.
- Preferir Server Actions / API routes para mutaciones sensibles; no writes client-side a tablas con secretos.
- UI y copy del producto en español.
- Ante duda de API Next.js: leer docs en `node_modules/next/dist/docs/` (esta versión no coincide con conocimiento entrenado).
- Datos: Prisma Client + migraciones; no SQL crudo en la app.

## Docs (no duplicar acá)

| Doc | Usar para |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | Alcance, reglas de negocio, entidades, aceptación |
| [`docs/ROADMAP-BACKEND.md`](docs/ROADMAP-BACKEND.md) | Fases backend, contratos, anti-duplicación, Afip SDK |
| [`docs/ROADMAP-FRONTEND.md`](docs/ROADMAP-FRONTEND.md) | Pantallas, estados UI, consumo de contratos |
| [`docs/CONTRATO-FRONTEND.md`](docs/CONTRATO-FRONTEND.md) | Contrato operativo FE ↔ backend (acciones, errores, estados) |

Si hay conflicto entre roadmaps y PRD, **prevalece el PRD**.
