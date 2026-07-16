# Documento de Requerimientos de Producto

## CRM con Facturación Electrónica ARCA — MVP 

---

## 1. Metadatos y alcance

| Campo | Valor |
| --- | --- |
| Producto | CRM + facturación electrónica ARCA (ex AFIP) |
| Versión | 3.2 — MVP Lean (solo Admin; stack Supabase) |
| Fecha | Julio 2026 |
| Estado | Listo para desarrollo |
| Modelo | Single-tenant / plantilla desplegable por empresa |
| País fiscal | Argentina |
| Integración | ARCA vía [Afip SDK](https://app.afipsdk.com/api/) (solo backend) |
| API fiscal | Base URL: `https://app.afipsdk.com/api/` (docs: Context7 `/websites/afipsdk`) |
| Stack | Next.js (App Router) + API routes / Server Actions + PostgreSQL (Supabase) + Supabase Storage |
| Ambiente inicial | Homologación ARCA obligatoria antes de producción |

**Plantilla:** un deployment = una empresa emisora. El esquema incluye `issuer_profile_id` (y `tenant_id` nullable documentado) desde el día 1 para no bloquear multi-empresa futuro. En MVP solo hay un emisor activo por deployment.

**Flujo núcleo:**

```text
Cliente → Borrador → Validaciones → Emisión ARCA → CAE → PDF → Cuenta corriente → Pago → Auditoría
```

---

## 2. Problema y objetivo

### Problema

Las PyMEs suelen separar clientes, facturación y cobros (planillas / sistemas distintos). Eso genera doble carga, errores de CUIT/condición fiscal, poca visibilidad de deuda y falta de trazabilidad entre factura, saldo y pago.

### Objetivo

Una plataforma plantilla que conecte CRM mínimo + motor financiero + emisión fiscal ARCA, de modo que:

1. Los datos del cliente alimenten el comprobante.
2. La emisión ocurra solo desde backend, con CAE persistido.
3. El saldo se actualice únicamente si ARCA autoriza.
4. Pagos e imputaciones cierren la cuenta corriente.
5. Toda acción sensible quede auditada.

---

## 3. Principios

1. **Capas separadas:** CRM (clientes/contactos) · comercial (conceptos/borradores) · fiscal ARCA · financiero (movimientos/pagos).
2. **Fiscal solo en backend:** certificados, claves, tokens WSAA y el access token de Afip SDK nunca llegan al frontend.
3. **Impacto financiero condicionado:** deuda/saldo/total facturado solo tras autorización ARCA.
4. **Auditoría de núcleo:** cambios sensibles e intentos de emisión son trazables e inmutables desde la app.
5. **Homologación primero:** producción bloqueada hasta validar en homologación; ambiente activo visible en UI.

---

## 4. Alcance incluido / excluido

### Incluido

* Login con **un único rol: Admin** (usuario administrador del deployment).
* Configuración fiscal del emisor + 1 punto de venta + homologación/producción.
* ABM de clientes (datos fiscales mínimos) y contactos.
* Conceptos facturables simples (sin listas de precios).
* Borradores y emisión de Factura A, B o C según configuración.
* Persistencia de CAE, vencimiento, número, respuesta e intentos de emisión.
* Anti-duplicación (lock, idempotency, unicidad PV + tipo + número + ambiente).
* PDF descargable; envío de email **manual**.
* Cuenta corriente por movimientos; pagos; imputación 1 pago → 1 o N facturas.
* Nota de crédito básica asociada a factura autorizada.
* Auditoría inmutable.
* Indicadores UI mínimos: error ARCA y config fiscal incompleta.
* Prueba end-to-end del sistema de facturación en **homologación ARCA** (config → borrador → emisión → CAE → PDF → CC → pago).

### Excluido (post-MVP)

* Multi-tenant / multi-empresa operativa (solo preparación de IDs).
* Roles adicionales (Operador, Lector, Vendedor, Cajero, Contador) y permisos granulares (`can_emit`, etc.).
* Facturación recurrente y jobs asociados.
* Notas de débito.
* Interacciones comerciales, scoring, health scores, etiquetas VIP/riesgo.
* Documentos adjuntos con vencimiento y alertas de docs.
* Listas de precios, segmentación avanzada, export CSV/Excel.
* Buscador avanzado y dashboard KPI-heavy.
* Alertas/recordatorios automáticos (email/WhatsApp), WhatsApp Business API.
* Tributos / percepciones / retenciones, multi-POS en UI, consulta padrón ARCA.
* Factura de exportación, FCE MiPyME completa, libro IVA, presentaciones.
* Integración bancaria, PSP (Mercado Pago, etc.), ERPs, app mobile, stock, sueldos.

---

## 5. Roles y permisos

### Rol MVP

En el MVP existe **un solo rol: Admin**. Toda la operación del sistema (CRM, facturación, cobros, config fiscal y auditoría) la realiza ese administrador autenticado. No hay Operador, Lector ni flags de permiso parciales.

| Rol | Descripción |
| --- | --- |
| **Admin** | Control total del deployment: config fiscal ARCA, clientes/contactos, conceptos, borradores, emisión (homologación y producción), PDF/email, pagos e imputaciones, NC, auditoría. Usuario único operativo del MVP. |

### Capacidades del Admin (MVP)

| Acción | Admin |
| --- | ---: |
| Ver clientes / comprobantes / PDF | Sí |
| Crear / editar clientes y contactos | Sí |
| Editar datos fiscales / límite de crédito | Sí |
| Gestionar conceptos | Sí |
| Crear borrador | Sí |
| Emitir / reintentar emisión (homologación y producción) | Sí |
| Enviar factura por email | Sí |
| Registrar / imputar pagos | Sí |
| Anular imputación / emitir NC | Sí |
| Ver auditoría | Sí |
| Configurar ARCA / credenciales / ambiente | Sí |
| Probar el flujo completo de facturación en homologación | Sí |

**Post-MVP:** introducir roles granulares (Operador, Lector, etc.) y permisos como `can_emit` sin reescribir el modelo de negocio.

---

## 6. Módulos funcionales

### 6.1 Configuración fiscal del emisor

**Objetivo:** habilitar emisión; sin config válida no hay emisión real.

**Datos mínimos:** razón social, CUIT, condición IVA, domicilio fiscal, ingresos brutos, inicio de actividades, email, logo (PDF), punto de venta, ambiente (homologación/producción), certificado y clave privada (cifrados), estado, fecha última validación, responsable.

**Estados:** `incomplete` · `validated_homologation` · `production_ready` · `error`

**Reglas:**

* El Admin configura y valida el emisor (única figura operativa del MVP).
* Frontend nunca recibe certificado ni clave.
* Separar homologación de producción; producción exige confirmación explícita.
* Homologación es el ambiente por defecto para **probar facturación** de punta a punta antes de activar producción.
* Toda modificación audita.
* Un `issuer_profile` activo por deployment en MVP.

### 6.2 Clientes y contactos

**Objetivo:** entidad comercial/fiscal/financiera mínima para emitir y cobrar.

**Cliente — datos:** tipo (persona/empresa), razón social o nombre, nombre comercial opcional, tipo y nro. documento (CUIT/CUIL/DNI), condición fiscal, email y teléfono principales, estado, observaciones, límite de crédito opcional, vendedor/usuario asignado opcional.

**Estados cliente:** `activo` · `inactivo` · `bloqueado`

**Contacto — datos:** nombre, apellido, email, teléfono, es principal, es facturación, observaciones.

**Reglas:**

* No emitir a inactivo/bloqueado (salvo override explícito del Admin).
* No emitir sin datos fiscales mínimos del receptor.
* Si supera límite de crédito (si está configurado): bloquear o pedir confirmación del Admin.
* Un solo contacto principal y un solo de facturación por cliente.
* Sin contacto de facturación → usar email principal del cliente.
* Cambios de CUIT, condición fiscal o límite de crédito → auditoría.

### 6.3 Conceptos y borradores

**Objetivo:** preparar comprobantes antes de emitir.

**Concepto:** código, nombre, descripción, tipo (producto/servicio), precio unitario, moneda (ARS), alícuota IVA, estado.

**Borrador:** cliente, contacto facturación, PV, tipo/letra sugeridos, fechas (comprobante y vencimiento pago), concepto ARCA (productos/servicios/ambos), ítems (cantidad, precio, bonificación), subtotales/IVA/total, observaciones, estado, creador, `issuer_profile_id`.

**Estados borrador:** `draft` · `emitting` · `issued` · `rejected` · `cancelled`

**Reglas:**

* El Admin crea borradores y emite (no hay otro rol emisor en MVP).
* Recalcular totales al cambiar ítems; totales enviados a ARCA = totales persistidos.
* Comprobante autorizado inmutable; corrección vía NC.
* En homologación, el Admin puede recorrer el flujo completo de prueba sin impacto fiscal real.

### 6.4 Motor fiscal ARCA

**Objetivo:** emitir comprobantes autorizados desde backend vía [Afip SDK](https://app.afipsdk.com/api/).

**Proveedor / API externa:**

* Base URL: `https://app.afipsdk.com/api/`
* Documentación: [docs.afipsdk.com](https://docs.afipsdk.com) (disponible en Context7 como `/websites/afipsdk`)
* Auth WSAA (ticket de acceso): `POST /api/v1/afip/auth` → `https://app.afipsdk.com/api/v1/afip/auth`
* Invocación a Web Services ARCA: `POST /api/v1/afip/requests` → `https://app.afipsdk.com/api/v1/afip/requests`
* Ambiente Afip SDK: `dev` (homologación) / `prod` (producción); header `Authorization: Bearer <access_token>`
* Web Service MVP: `wsid: "wsfe"` (Factura Electrónica)

**Endpoints internos (ejemplos):** validar borrador, solicitar emisión, consultar estado, obtener PDF, reenviar email, consultar último/emitido, reintentar error técnico.

**Tipos MVP:** Factura A/B/C. Disponibilidad según condición emisor/receptor y ARCA.

**Comprobante — persistir:** cliente, borrador origen, tipo/letra, PV, número, fechas, concepto, moneda/cotización, importes (neto, no gravado, exento, IVA, total), CAE y vencimiento, resultado/obs/errores ARCA, estado, PDF ref, emisor usuario, ambiente, `issuer_profile_id`.

**Estados comprobante:** `authorized` · `rejected` · `technical_error` (el borrador cubre el pre-envío).

**Flujo de emisión:**

1. Crear/seleccionar cliente y borrador.
2. Pre-cargar y validar datos, estado cliente, crédito, config emisor.
3. El Admin solicita emisión (única figura autorizada en MVP).
4. Backend lock del borrador → consulta último número si corresponde → envía a ARCA.
5. **Autorizado:** guarda CAE/número/respuesta → PDF → movimiento de CC → auditoría → (email solo si el Admin lo dispara).
6. **Rechazado:** guarda respuesta, no impacta saldo, permite corregir/reintentar según reglas.
7. **Error técnico:** guarda intento, no duplica, permite reconsulta/reintento controlado.

**Intento de emisión (tabla propia):** borrador, comprobante si existe, usuario, timestamp, ambiente, request/response normalizados, error, resultado, duración, nro. reintento, estado.

**Anti-duplicación:**

* Evitar doble click y emisiones concurrentes del mismo borrador.
* Idempotency key por intento.
* Lock transaccional del borrador.
* Unicidad: ambiente + PV + tipo + número.
* No actualizar saldo antes de autorización; ante timeout, reconsultar antes de reemitir.

### 6.5 PDF y email

**Objetivo:** PDF del comprobante autorizado + envío manual.

**Reglas:**

* PDF solo si autorizado (o válido en homologación).
* Incluir emisor, receptor, importes, CAE, vencimiento CAE, QR si corresponde.
* Guardar en Supabase Storage; DB guarda referencia (path/URL del objeto).
* Reenvío por email al contacto de facturación; registrar resultado del envío.
* Sin envío automático en MVP.

**Estados envío (si aplica):** `not_sent` · `sent` · `failed` · `resent`

### 6.6 Cuenta corriente, pagos e imputaciones

**Objetivo:** deuda y cobros derivados de movimientos reales.

**Origen de movimientos:** facturas autorizadas (+), NC autorizadas (−), pagos imputados (−). Sin ajustes administrativos libres en MVP.

**Estados de pago de factura:** `pending` · `partial` · `paid` · `overdue`

**Pago:** cliente, fecha, monto, moneda, método (efectivo / transferencia / cheque / tarjeta / otro), referencia, notas, usuario, estado.

**Imputación:** un pago a una o varias facturas; parcial permitido; no auto-imputar a la más antigua; no imputar más que el saldo pendiente; deshacer imputación permitido al Admin (única figura operativa).

**Reglas:**

* Registrar pago ≠ saldar factura sin imputación.
* Saldos calculados desde movimientos, no editados a mano.
* Cambios de imputación auditados.
* Rechazos fiscales no generan deuda.

### 6.7 Nota de crédito básica

**Objetivo:** anular o corregir comprobantes autorizados.

**Casos:** anulación total/parcial, descuento posterior, devolución/corrección comercial.

**Reglas:**

* Factura autorizada no se elimina ni edita.
* NC asociada al comprobante original; propio CAE.
* CC se actualiza solo si NC autorizada.
* Monto NC ≤ saldo compensable de la factura (salvo override explícito del Admin).

### 6.8 Auditoría

**Eventos mínimos:** cambios de CUIT/condición fiscal/límite de crédito; emisión, rechazo, reintento; NC; pagos e imputaciones/reverso; config ARCA; alta/cambio de usuario Admin; baja lógica de cliente/contacto.

**Campos:** timestamp, usuario, entidad, id, acción, campo, valor anterior/nuevo, IP/UA si disponible, motivo en acciones críticas.

**Reglas:** no editable ni eliminable desde la app; filtrable por cliente, usuario, entidad, fecha.

---

## 7. Modelo de datos (MVP)

### Entidades

**Seguridad:** `users` (rol fijo Admin en MVP) · `audit_logs`  
*(tabla `roles` / flags como `can_emit` reservados para post-MVP; no se exponen en UI ni se aplican en autorización del MVP)*

**Plantilla / emisor:** `issuer_profiles` · `issuer_fiscal_settings` · `arca_credentials` · `arca_ticket_storage` · `fiscal_points_of_sale`  
*(incluir `issuer_profile_id`; `tenant_id` nullable reservado para multi-tenant futuro)*

**CRM:** `clients` · `client_contacts` · `client_addresses` (fiscal; comercial opcional)

**Facturación:** `billable_items` · `invoice_drafts` · `invoice_draft_items` · `fiscal_vouchers` · `fiscal_voucher_items` · `fiscal_voucher_iva` · `fiscal_voucher_associated` · `fiscal_emission_attempts` · `fiscal_pdf_files`

**Finanzas:** `account_movements` · `payments` · `payment_allocations`

**Comunicación:** `email_logs` (envíos de comprobante)

### Fuera del modelo MVP

`client_interactions`, `client_health_scores`, `client_price_history`, `price_lists`, `recurring_*`, `debit_notes`, `notifications` elaboradas, `client_documents`, `financial_adjustments` libres.

---

## 8. Reglas críticas

### Clientes

* Validar formato de documento.
* Razón social, condición fiscal (y domicilio si el tipo de comprobante lo exige) obligatorios para emitir.
* Email de facturación obligatorio solo para envío, no para emisión.

### Comprobantes

* Autorizado = inmutable e indeleble.
* CAE, vencimiento CAE, PV y número obligatorios si autorizado.
* Número único por ambiente + PV + tipo.
* PDF desde datos persistidos, no desde estado temporal del frontend.

### Saldos

* Saldo = suma de movimientos.
* Factura autorizada suma deuda; NC autorizada reduce; pago imputado reduce.
* Pago sin imputar = pendiente de imputación / saldo a favor según reglas de UI.
* Rechazo o error técnico = sin impacto en deuda.

### Anti-duplicación y pagos

* Lock + idempotency + unicidad fiscal.
* No imputar por encima del pendiente; reverso de imputación auditado.

---

## 9. Arquitectura

```text
[Next.js UI] → [Server Actions / API routes]
                    ↓
        Auth (Admin) · Services · Repositories
                    ↓
         ArcaAdapter (Afip SDK API) · PDF · Email · Storage
                    ↓
         https://app.afipsdk.com/api/  →  ARCA (WSAA / WSFE)
                    ↓
         Supabase (PostgreSQL + Storage) · Tickets WSAA persistidos
```

* Frontend: CRM, borradores, visualización, descarga PDF, pagos, config fiscal y prueba de emisión. Sin lógica fiscal sensible.
* Backend: autenticación Admin, orquestación de emisión, certificados, tickets WSAA, PDF, email, transacciones, auditoría, saldos.
* Adapter propio alrededor de Afip SDK (`https://app.afipsdk.com/api/`): request interno normalizado ↔ `/api/v1/afip/auth` y `/api/v1/afip/requests`; persistir request/response; errores funcionales vs técnicos.
* Datos: PostgreSQL en Supabase; PDFs y archivos (p. ej. logo del emisor) en **Supabase Storage** (sin bucket S3 externo).
* Credenciales: CUIT, cert, clave, ambiente, access token Afip SDK, estado, fechas de prueba/emisión; cifrado en reposo; rotación manual; nunca al cliente.

---

## 10. Requerimientos no funcionales

**Seguridad:** auth obligatoria; sesión restringida a Admin en MVP; secretos cifrados; anti doble emisión; validación server-side; backups DB. Diseño preparado para RBAC multi-rol post-MVP.

**Disponibilidad:** CRM usable si ARCA está caído; emisión en error técnico controlado; comprobantes autorizados siempre consultables.

**Performance (inicial):** búsqueda simple de clientes con índices (CUIT, razón social, email); listados paginados; historial bajo demanda; PDF cacheado tras autorización.

**Plantilla / evolución:** single-tenant por deployment; `issuer_profile_id` en config y comprobantes; evitar hardcode del emisor en lógica de negocio.

**Mantenibilidad:** capas controllers/services/repos/adapters; tests de totales, saldos, auth Admin y anti-duplicación.

---

## 11. Criterios de aceptación

### CRM

* [ ] Crear, editar, buscar (texto simple) y consultar clientes.
* [ ] Múltiples contactos; marcar principal y de facturación.
* [ ] Dirección fiscal; límite de crédito opcional.

### Facturación

* [ ] Borrador con datos pre-cargados del cliente.
* [ ] Validar estado, datos fiscales y crédito antes de emitir.
* [ ] Admin emite factura en homologación; persistir CAE, vencimiento, PV, número, respuesta.
* [ ] Flujo de prueba completo en homologación: config emisor → cliente → borrador → emisión → CAE → PDF → CC.
* [ ] PDF descargable; comprobante autorizado no editable.
* [ ] Rechazo/error técnico sin impacto en saldo; intentos registrados.
* [ ] NC básica asociada a factura autorizada con CAE propio.

### Finanzas

* [ ] Factura autorizada impacta CC.
* [ ] Admin registra pago e imputa a una o más facturas; ver saldo y vencido.

### Auditoría y seguridad

* [ ] Logs de cambios sensibles, emisión y config fiscal; no editables desde la app.
* [ ] Solo Admin autenticado opera el sistema; certificados invisibles en frontend.
* [ ] Ambiente fiscal activo visible en UI (homologación vs producción).

---

## 12. Roadmaps de implementación

El plan de entrega por tecnología (~6–8 semanas, 4 fases sincronizadas) vive fuera de este PRD para no mezclar requisitos de producto con desglose técnico:

| Track | Documento |
| --- | --- |
| Backend | [ROADMAP-BACKEND.md](./ROADMAP-BACKEND.md) |
| Frontend | [ROADMAP-FRONTEND.md](./ROADMAP-FRONTEND.md) |

**Fases compartidas (resumen):**

1. **Base y CRM** (sem. 1–2) — CRM usable por Admin sin emisión.
2. **Comercial y financiero interno** (sem. 3–4) — borradores y deuda/pagos sin ARCA.
3. **ARCA homologación** (sem. 5–6) — factura/NC con CAE; saldo solo si autorizado.
4. **PDF, email, producción controlada** (sem. 7–8) — flujo completo para casos simples en producción.

Este PRD es la fuente de verdad funcional. Los roadmaps deben respetarlo en todo momento y mantener coherencia entre sí (mismos hitos H1–H4).

---

## 13. Riesgos (top)

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Mala config / credenciales ARCA | Alto | Homologación obligatoria; estado `error` visible |
| Exposición de certificados | Alto | Backend-only + cifrado + auth Admin |
| Ataques de fuerza bruta / flood de login | Alto | Rate limiting por IP y por usuario; bloqueo temporal tras N fallos; CAPTCHA o delay progresivo si aplica |
| Doble emisión | Alto | Lock, idempotency, unicidad PV/tipo/número/ambiente |
| Totales / IVA incorrectos | Alto | Cálculo server-side + tests |
| Timeout / ARCA caído | Alto | Estados técnicos, reconsulta, no reemitir a ciegas |
| Saldos incorrectos | Alto | Movimientos como fuente de verdad |

---

## 14. Decisiones técnicas obligatorias

1. Emisión fiscal solo en backend vía adapter de Afip SDK (`https://app.afipsdk.com/api/`).
2. Frontend sin certificados, claves ni tokens.
3. Comprobante autorizado inmutable; corrección con NC.
4. Todo intento y rechazo fiscal se persiste.
5. Saldo desde movimientos; pagos con imputación explícita.
6. Homologación antes de producción.
7. Un PV y un emisor activo por deployment en MVP.
8. `issuer_profile_id` (y `tenant_id` nullable) desde el esquema inicial.
9. Stack: Next.js + Supabase (PostgreSQL + Storage); sin S3 externo.
10. Integración fiscal es parte del MVP, no post-MVP.

---

## 15. Backlog post-MVP

Multi-empresa / multi-tenant operativo · roles granulares (Operador, Lector, etc.) y permisos (`can_emit`) · recurrencia · ND · padrón ARCA · listas de precios · interacciones CRM · documentos con vencimiento · alertas/recordatorios · export · reportes fiscales / libro IVA · FCE MiPyME · exportación · tributos/percepciones · multi-POS · WhatsApp · bancos/PSP · presupuestos · stock · API pública / webhooks · mobile.

---

## 16. Disclaimer fiscal

Validar con contador/asesor fiscal antes de producción. El software facilita emisión y trazabilidad; no reemplaza la responsabilidad del contribuyente ni el criterio profesional sobre tipos de comprobante, alícuotas o regímenes especiales. La primera versión productiva debe operar con casos fiscales simples y controlados.
