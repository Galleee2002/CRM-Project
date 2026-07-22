# Contrato Frontend ↔ Backend (H1)

> Fuente operativa para construir la UI sobre Server Actions.  
> Fuente de verdad de negocio: [PRD.md](./PRD.md). Fases: [ROADMAP-FRONTEND.md](./ROADMAP-FRONTEND.md) · [ROADMAP-BACKEND.md](./ROADMAP-BACKEND.md).

**Alcance actual:** Fase 1 / hito **H1** — Auth Admin + CRM + auditoría lectura. Sin emisión ARCA, borradores, CC ni PDF.

---

## Reglas de consumo

1. Toda mutación sensible va por **Server Actions** (no writes client-side a Postgres).
2. Rutas de dashboard exigen sesión **Admin** (`users.role = admin` + Supabase Auth).
3. Shape de respuesta unificado:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ActionErrorCode; message: string; fields?: Record<string, string[]> } };
```

4. Códigos de error (H1 en uso; el resto reservado):

| Código | Cuándo |
| --- | --- |
| `validation_error` | Zod / documento inválido (`fields` por campo) |
| `business_rule` | Rate limit login, emisor ausente, etc. |
| `conflict` | Documento de cliente duplicado (activo) |
| `unauthorized` | Sin sesión o credenciales inválidas |
| `forbidden` | Autenticado pero no Admin |
| `not_found` | Cliente/contacto/dirección inexistente |
| `fiscal_rejected` / `fiscal_technical_error` | Fases 3+ |

5. UI en español; totales/saldos/fiscal **nunca** se inventan en el cliente (aún no aplica en H1).

---

## Mapa pantalla → action → path

| Pantalla / flujo UI | Action | Archivo |
| --- | --- | --- |
| Login | `loginAction` | [`src/features/auth/actions/auth-actions.ts`](../src/features/auth/actions/auth-actions.ts) |
| Logout | `logoutAction` | idem |
| Sesión actual (shell) | `getSessionAction` | idem |
| Listado clientes + búsqueda | `listClientsAction` | [`src/features/clients/actions/client-actions.ts`](../src/features/clients/actions/client-actions.ts) |
| Detalle cliente | `getClientAction` | idem |
| Alta cliente | `createClientAction` | idem |
| Edición cliente | `updateClientAction` | idem |
| Baja lógica cliente | `softDeleteClientAction` | idem |
| Alta contacto | `createContactAction` | idem |
| Edición contacto | `updateContactAction` | idem |
| Baja contacto | `softDeleteContactAction` | idem |
| Alta dirección | `createAddressAction` | idem |
| Edición dirección | `updateAddressAction` | idem |
| Baja dirección | `softDeleteAddressAction` | idem |
| Auditoría (solo lectura) | `listAuditLogsAction` | [`src/features/audit/actions/audit-actions.ts`](../src/features/audit/actions/audit-actions.ts) |

Helpers de tipos/resultado: [`src/lib/action-result.ts`](../src/lib/action-result.ts).

---

## Catálogo de operaciones H1

### Auth

#### `loginAction(input)`

```ts
input: { email: string; password: string }
data: { user: { id; email; fullName; role: "admin" } }
```

IP y User-Agent se capturan solo en servidor (headers). No enviarlos en el input.

Errores: `validation_error`, `unauthorized`, `forbidden`, `business_rule` (bloqueo por rate limit).

#### `logoutAction()`

Cierra sesión Supabase y redirige a `/login`.

#### `getSessionAction()` → `{ user: SessionUserDto | null }`

### Clientes

#### `listClientsAction({ q?, status?, page?, pageSize? })`

- `q`: busca en razón social, nombre comercial, documento, email.
- `status`: `activo` \| `inactivo` \| `bloqueado`.
- Respuesta: `{ items, total, page, pageSize, totalPages }`.

#### `getClientAction(id)` / `createClientAction` / `updateClientAction`

Campos create (Zod): `type`, `legalName`, `tradeName?`, `documentType` (`CUIT`\|`CUIL`\|`DNI`), `documentNumber`, `taxCondition`, `email?`, `phone?`, `status?`, `notes?`, `creditLimit?`, `assignedUserId?`.

DTO incluye:

- `contacts[]`, `addresses[]`
- `billingEmailFallback: boolean` — si `true`, UI debe indicar que se usará el email principal del cliente
- `billingEmail` — email efectivo sugerido para facturación

#### `softDeleteClientAction(id, reason?)`

### Contactos

- Un solo `isPrimary` y un solo `isBilling` por cliente (backend limpia flags previos).
- Create/update/soft-delete vía actions de arriba.

### Direcciones

- `kind`: `fiscal` \| `comercial` (default `fiscal`).
- Campos: `street`, `number?`, `floor?`, `apartment?`, `city`, `state`, `postalCode?`, `country` (default `AR`).

### Auditoría

#### `listAuditLogsAction({ clientId?, userId?, entity?, from?, to?, page?, pageSize? })`

- Solo lectura. Sin update/delete.
- `from` / `to`: ISO strings.

---

## Estados de dominio (UI H1)

| Entidad | Valores |
| --- | --- |
| Cliente | `activo` · `inactivo` · `bloqueado` |
| Dirección | `fiscal` · `comercial` |

**Fuera de H1 (no consumir aún):** borradores, conceptos, emisión, config fiscal ARCA, CC, pagos, PDF, email, NC. Ver fases 2–4 en el roadmap.

---

## Checklist FE H1

- [ ] Login / logout / redirect a `/login` si no hay sesión
- [ ] Shell dashboard (nav mínima: Clientes, Auditoría)
- [ ] Listado + búsqueda + paginación de clientes
- [ ] Alta / edición / detalle + contactos + dirección fiscal
- [ ] Empty / loading / `validation_error` / `unauthorized`
- [ ] Auditoría filtrable solo lectura
- [ ] Sin pantallas de emisión ni secretos fiscales

---

## Seed / Admin

Crear Admin en un solo paso (Supabase Auth + fila `users` + `issuer_profile`):

```bash
npm run admin:create -- admin@empresa.com "TuPasswordSegura"
```

Requisitos en `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.

Si el email ya existe en Auth, el script lo reutiliza, actualiza la password y sincroniza `users`.

Sin perfil Admin en `users`, el login autentica en Supabase pero responde `forbidden`.
