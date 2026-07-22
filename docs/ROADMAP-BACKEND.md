# Roadmap Backend — CRM + Facturación Electrónica ARCA (MVP)

> **Fuente de verdad:** [PRD.md](./PRD.md). Ante cualquier discrepancia entre este documento y el PRD, prevalece el PRD.  
> **Track paralelo:** [ROADMAP-FRONTEND.md](./ROADMAP-FRONTEND.md) — mismas fases, semanas e hitos de integración.  
> **Horizonte:** ~6–8 semanas · **Rol MVP:** Admin único · **Stack:** Next.js (Server Actions / API routes) + PostgreSQL (Supabase) + Prisma + Supabase Storage + Afip SDK

---

## Principios obligatorios (backend)

1. Emisión fiscal **solo en backend** vía adapter de Afip SDK (`https://app.afipsdk.com/api/`).
2. Certificados, claves privadas, tickets WSAA y access token de Afip SDK **nunca** se exponen al frontend.
3. Impacto financiero (deuda/saldo) **solo** tras autorización ARCA.
4. Comprobante autorizado = inmutable; corrección vía Nota de Crédito.
5. Todo intento de emisión (éxito, rechazo, error técnico) se persiste.
6. Saldo = suma de movimientos; pagos requieren imputación explícita.
7. Homologación antes de producción; un PV y un emisor activo por deployment.
8. `issuer_profile_id` (y `tenant_id` nullable) desde el esquema día 1.
9. Capas: controllers / services / repositories / adapters.
10. Validación, autorización Admin y cálculos de totales/IVA **siempre server-side**.

---

## Contratos que el frontend consume

Contrato operativo FE ↔ backend: [CONTRATO-FRONTEND.md](./CONTRATO-FRONTEND.md).

El backend expone operaciones (Server Actions / API routes) con respuestas normalizadas. El frontend **no** decide lógica fiscal ni saldos.

| Dominio | Operaciones típicas | Qué NO se expone |
| --- | --- | --- |
| Auth | login, logout, sesión Admin | secretos de sesión internos |
| CRM | CRUD clientes/contactos/direcciones, búsqueda simple | — |
| Conceptos / borradores | CRUD, recalcular totales, validar pre-emisión | — |
| Config fiscal | leer estado/datos públicos del emisor, subir cert (multipart → backend), validar, cambiar ambiente | cert PEM, clave, tickets, tokens |
| Emisión | emitir, consultar estado, reintentar, reconsultar | request/response crudos sensibles sin filtrar |
| PDF / email | obtener URL firmada o stream, enviar email manual | keys de Storage |
| Finanzas | listar CC, registrar pago, imputar, deshacer imputación | — |
| NC | crear/emitir NC asociada | — |
| Auditoría | listar/filtrar logs (solo lectura) | — |

**Errores normalizados (contrato):**

* `validation_error` — datos incompletos o inválidos
* `business_rule` — cliente bloqueado, crédito excedido, config incompleta, etc.
* `fiscal_rejected` — ARCA rechazó; sin impacto en saldo
* `fiscal_technical_error` — timeout/caída; permite reconsulta/reintento controlado
* `conflict` — lock, idempotency, unicidad fiscal
* `unauthorized` / `forbidden` — auth Admin

**Estados de dominio (alineados al PRD):**

* Emisor: `incomplete` · `validated_homologation` · `production_ready` · `error`
* Cliente: `activo` · `inactivo` · `bloqueado`
* Borrador: `draft` · `emitting` · `issued` · `rejected` · `cancelled`
* Comprobante: `authorized` · `rejected` · `technical_error`
* Pago factura: `pending` · `partial` · `paid` · `overdue`
* Email: `not_sent` · `sent` · `failed` · `resent`

---

## Hitos de integración compartidos

| ID | Checkpoint | Semana aprox. | Backend listo cuando… | Frontend listo cuando… |
| --- | --- | --- | --- | --- |
| **H1** | CRM usable | fin Fase 1 | Auth Admin + ABM CRM + auditoría base | Login + pantallas CRM operables |
| **H2** | Comercial + finanzas internas | fin Fase 2 | Conceptos, borradores, CC, pagos sin ARCA | UI de borradores, CC y pagos |
| **H3** | Flujo ARCA homologación E2E | fin Fase 3 | Emisión A/B/C + NC con CAE; saldo solo si autorizado | Config fiscal segura + emisión/reintentos en UI |
| **H4** | Producción controlada | fin Fase 4 | PDF, email, hardening, activación prod | Descarga PDF, email manual, confirmación prod |

---

## Fase 1 — Base y CRM (sem. 1–2)

**Objetivo PRD:** setup + auth Admin + modelo inicial + ABM clientes/contactos/direcciones + auditoría base.  
**Trazabilidad PRD:** §§ 5, 6.2, 6.8, 7, 9, 10, 11 (CRM), 14.

### Tareas técnicas

1. **Infraestructura**
   * Proyecto Next.js (App Router) con Server Actions / API routes.
   * Proyecto Supabase: PostgreSQL + Auth + bucket Storage (logo/PDFs futuros).
   * Prisma: `prisma migrate` para el esquema de dominio; Prisma Client en repositories.
   * Variables de entorno; sin secretos en cliente.
2. **Esquema inicial** (Prisma)
   * `users` (rol fijo Admin en MVP).
   * `issuer_profiles` con `issuer_profile_id`; `tenant_id` nullable reservado.
   * `clients`, `client_contacts`, `client_addresses`.
   * `audit_logs` (append-only desde la app).
   * Índices: CUIT, razón social, email (búsqueda simple).
3. **Auth**
   * Login/logout; sesión restringida a Admin.
   * Rate limiting por IP/usuario; bloqueo temporal tras N fallos (mitigación PRD §13).
   * Middleware/guards: toda ruta sensible exige Admin autenticado.
4. **Servicios CRM**
   * CRUD clientes con estados `activo` / `inactivo` / `bloqueado`.
   * Contactos: un solo principal y un solo de facturación por cliente (regla enforced en DB o service).
   * Dirección fiscal; límite de crédito opcional.
   * Validación de formato de documento (CUIT/CUIL/DNI).
   * Búsqueda simple + listados paginados.
5. **Auditoría base**
   * Registrar: alta/edición de cliente/contacto; cambios de CUIT, condición fiscal, límite de crédito; alta/cambio de usuario Admin; baja lógica.
   * Campos: timestamp, usuario, entidad, id, acción, campo, valor anterior/nuevo, IP/UA si disponible, motivo en críticos.
   * Sin update/delete desde la app.

### Dependencias del frontend

* El FE necesita endpoints/actions estables de auth y CRM para alcanzar **H1**.
* Exponer errores de validación claros para formularios.

### Criterios de salida (backend)

* [ ] Admin puede autenticarse; no-Admin no opera.
* [ ] CRUD clientes/contactos/direcciones persistido con reglas de unicidad de contactos.
* [ ] Búsqueda por texto simple funciona con índices.
* [ ] `issuer_profile_id` presente en esquema; sin hardcode de emisor en lógica.
* [ ] `audit_logs` inmutables desde la app para eventos sensibles de CRM.
* [ ] Tests: validación documento, unicidad contacto principal/facturación, auth Admin.

### Entregable

**CRM usable por Admin sin emisión** (H1).

---

## Fase 2 — Comercial y financiero interno (sem. 3–4)

**Objetivo PRD:** conceptos, borradores, totales, límite de crédito, movimientos/CC, pagos e imputación — **sin ARCA**.  
**Trazabilidad PRD:** §§ 6.3, 6.6, 7, 8, 11 (Finanzas parcial), 14.5.

### Tareas técnicas

1. **Modelo comercial**
   * `billable_items` (conceptos): código, nombre, descripción, tipo producto/servicio, precio, ARS, alícuota IVA, estado.
   * `invoice_drafts` + `invoice_draft_items` con `issuer_profile_id`.
   * Estados borrador: `draft` · `emitting` · `issued` · `rejected` · `cancelled` (en esta fase: principalmente `draft` / `cancelled`; `emitting`/`issued`/`rejected` se activan en Fase 3).
2. **Cálculo de totales (server-side)**
   * Recalcular al cambiar ítems: cantidad, precio, bonificación → neto, IVA, total.
   * Totales persistidos = fuente de verdad (luego serán los enviados a ARCA).
   * Tests unitarios de totales/IVA (riesgo PRD §13).
3. **Validaciones pre-emisión (sin llamar ARCA)**
   * Cliente activo (o override Admin explícito).
   * Datos fiscales mínimos del receptor.
   * Límite de crédito: bloquear o exigir confirmación Admin.
4. **Modelo financiero**
   * `account_movements`, `payments`, `payment_allocations`.
   * En Fase 2: permitir movimientos de prueba / pagos e imputaciones sobre “deuda simulada” o facturas internas stub **solo si el diseño lo requiere para UI**; preferible: APIs de pagos/CC listas, impacto de factura real llega en Fase 3 al autorizar.
   * Regla: registrar pago ≠ saldar sin imputación.
   * Imputación 1 pago → 1 o N facturas; parcial OK; no auto-imputar a la más antigua; no superar saldo pendiente.
   * Deshacer imputación (Admin) + auditoría.
5. **Estados de pago de factura:** `pending` · `partial` · `paid` · `overdue` (cálculo derivado de movimientos/vencimiento).

### Dependencias del frontend

* Contrato de borrador: create/update/recalculate/validate.
* Contrato de pagos: create, allocate, reverse allocation, listar CC por cliente.
* Señales de límite de crédito excedido (`business_rule` + flag para confirmación Admin).

### Criterios de salida (backend)

* [ ] CRUD conceptos y borradores con totales recalculados en servidor.
* [ ] Validación de crédito y estado de cliente antes de “listo para emitir”.
* [ ] Pagos e imputaciones respetan reglas; reverso auditado.
* [ ] Saldos se calculan desde movimientos (nunca editados a mano).
* [ ] Tests: totales/IVA, imputación parcial, no-overallocate, reverso.

### Entregable

**Borradores y deuda/pagos sin ARCA** (H2).

---

## Fase 3 — ARCA homologación (sem. 5–6)

**Objetivo PRD:** config emisor, credenciales cifradas, adapter Afip SDK, tickets, emisión A/B/C, anti-duplicación, NC básica en **homologación**. Prioridad: flujo de prueba E2E.  
**Trazabilidad PRD:** §§ 6.1, 6.4, 6.7, 7, 8, 9, 11 (Facturación), 14.

### Tareas técnicas

1. **Configuración fiscal del emisor**
   * Tablas: `issuer_fiscal_settings`, `arca_credentials`, `arca_ticket_storage`, `fiscal_points_of_sale`.
   * Datos mínimos PRD §6.1; un PV; ambiente default = homologación.
   * Estados emisor: `incomplete` · `validated_homologation` · `production_ready` · `error`.
   * Cifrado en reposo de certificado y clave; rotación manual.
   * API de lectura: **solo** datos públicos + estado (sin secretos).
   * Upload de credenciales: multipart → backend cifra y guarda; frontend nunca vuelve a leer el secreto.
   * Auditoría de toda modificación de config.
2. **ArcaAdapter (Afip SDK)**
   * Base URL: `https://app.afipsdk.com/api/`
   * Auth WSAA: `POST /api/v1/afip/auth`
   * Requests WSFE: `POST /api/v1/afip/requests` con `wsid: "wsfe"`
   * Ambiente SDK: `dev` (homologación) / `prod`
   * Header: `Authorization: Bearer <access_token>` (solo server)
   * Persistencia de tickets WSAA; normalización request/response; clasificación error funcional vs técnico.
3. **Modelo de comprobantes**
   * `fiscal_vouchers`, `fiscal_voucher_items`, `fiscal_voucher_iva`, `fiscal_voucher_associated`, `fiscal_emission_attempts`.
   * Persistencia: CAE, vencimiento, PV, número, respuesta, ambiente, `issuer_profile_id`, etc.
4. **Flujo de emisión (transaccional)**
   1. Validar borrador + cliente + crédito + config emisor.
   2. Lock del borrador → estado `emitting`.
   3. Idempotency key por intento.
   4. Consultar último número si corresponde.
   5. Enviar a ARCA vía adapter.
   6. **Autorizado:** guardar CAE/número/respuesta → movimiento CC (+) → auditoría → borrador `issued`.
   7. **Rechazado:** persistir respuesta; **sin** movimiento; borrador `rejected`; permitir corregir/reintentar según reglas.
   8. **Error técnico:** persistir intento; **sin** duplicar; reconsultar antes de reemitir.
5. **Anti-duplicación**
   * Lock transaccional; idempotency; unicidad `ambiente + PV + tipo + número`.
6. **Nota de crédito básica**
   * Asociada a factura autorizada; propio CAE; CC (−) solo si autorizada.
   * Monto NC ≤ saldo compensable (salvo override Admin explícito + auditoría).
7. **Endpoints internos**
   * Validar borrador, solicitar emisión, consultar estado, consultar último/emitido, reintentar error técnico.
   * (PDF/email se completan en Fase 4; puede quedar stub de “obtener PDF”.)

### Dependencias del frontend

* Contrato de config: get status, update public fields, upload credentials, validate homologation, request production (Fase 4).
* Contrato de emisión: emit, get attempt/status, retry, create NC.
* Ambiente activo en respuestas para badge UI.
* Nunca devolver cert/clave/token en JSON.

### Criterios de salida (backend)

* [ ] Emisor configurable; secretos cifrados; frontend sin secretos.
* [ ] Emisión Factura A/B/C en homologación con CAE persistido.
* [ ] Rechazo y error técnico sin impacto en saldo; intentos registrados.
* [ ] Anti-duplicación verificada (lock + idempotency + unicidad).
* [ ] NC básica con CAE en homologación y movimiento CC correcto.
* [ ] Flujo E2E backend: config → borrador → emisión → CAE → movimiento CC.
* [ ] Tests: anti-duplicación, no impacto en rechazo, totales = payload ARCA, NC.

### Entregable

**Factura (y NC) con CAE en homologación; saldo solo si autorizado; flujo de prueba operable** (H3).

---

## Fase 4 — PDF, email, producción controlada (sem. 7–8)

**Objetivo PRD:** PDF + Storage, email manual + logs, hardening, tests críticos, activación producción con confirmación, backup/monitoreo, doc operativa.  
**Trazabilidad PRD:** §§ 6.5, 10, 11, 13, 14.6, 16.

### Tareas técnicas

1. **PDF**
   * Generar solo si comprobante `authorized` (o válido en homologación).
   * Contenido: emisor, receptor, importes, CAE, vencimiento CAE, QR si corresponde.
   * Generar desde datos **persistidos**, no desde estado temporal del cliente.
   * Guardar en Supabase Storage; `fiscal_pdf_files` con path/URL de referencia.
   * Cachear tras autorización; URL firmada o stream autenticado para descarga.
2. **Email manual**
   * Envío al contacto de facturación (o email principal del cliente).
   * `email_logs` con estados `not_sent` · `sent` · `failed` · `resent`.
   * Sin envío automático en MVP.
3. **Producción controlada**
   * Producción bloqueada hasta `validated_homologation` (o equivalente PRD).
   * Activación a producción exige confirmación explícita del Admin + auditoría.
   * Ambiente activo visible vía API.
4. **Hardening**
   * Revisar rate limiting login; secrets; backups DB; monitoreo básico de errores de emisión.
   * Tests críticos: totales, saldos, auth Admin, anti-duplicación, flujo emisión.
5. **Documentación operativa**
   * Cómo configurar emisor, rotar credenciales, operar homologación vs producción, disclaimer fiscal (PRD §16).

### Dependencias del frontend

* Descarga PDF y reenvío email.
* UI de confirmación fuerte para pasar a producción.
* Indicadores: error ARCA, config fiscal incompleta, ambiente activo.

### Criterios de salida (backend)

* [ ] PDF descargable desde Storage para comprobantes autorizados.
* [ ] Email manual con log de resultado.
* [ ] Activación producción con confirmación y auditoría; homologación sigue siendo el default seguro.
* [ ] Suite de tests críticos en verde.
* [ ] Doc operativa publicada en `docs/`.

### Entregable

**Flujo completo listo para casos simples en producción** (sujeto a validación fiscal externa) (H4).

---

## Fuera de alcance (post-MVP) — no implementar en este roadmap

Multi-tenant operativo · roles granulares · recurrencia · ND · padrón ARCA · listas de precios · interacciones CRM · documentos con vencimiento · alertas automáticas · export · libro IVA · FCE · tributos/percepciones · multi-POS · WhatsApp · bancos/PSP · stock · API pública.

---

## Checklist de coherencia con el frontend

| Fase | Backend entrega | Frontend debe consumir |
| --- | --- | --- |
| 1 | Auth + CRM + audit | Login, ABM, búsqueda, sin emisión |
| 2 | Conceptos, borradores, CC, pagos | Formularios, totales mostrados (server), pagos/imputación |
| 3 | Config + emisión + NC homologación | UI config sin secretos, emitir/reintentar, estados fiscales |
| 4 | PDF, email, prod | Descarga, email manual, confirmación producción |

---

*Versión alineada al PRD 3.2 — MVP Lean (solo Admin; Supabase Auth/Storage + Prisma).*
