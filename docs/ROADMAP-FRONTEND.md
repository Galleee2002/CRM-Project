# Roadmap Frontend — CRM + Facturación Electrónica ARCA (MVP)

> **Fuente de verdad:** [PRD.md](./PRD.md). Ante cualquier discrepancia entre este documento y el PRD, prevalece el PRD.  
> **Track paralelo:** [ROADMAP-BACKEND.md](./ROADMAP-BACKEND.md) — mismas fases, semanas e hitos de integración.  
> **Horizonte:** ~6–8 semanas · **Rol MVP:** Admin único · **Stack:** Next.js (App Router) + UI sobre Server Actions / API routes · **Sin lógica fiscal sensible en el cliente**

---

## Principios obligatorios (frontend)

1. El frontend es capa de **CRM, borradores, visualización, descarga PDF, pagos, config fiscal y prueba de emisión** — sin lógica fiscal sensible (PRD §9).
2. **Nunca** solicitar, cachear ni mostrar certificados, claves privadas, tickets WSAA ni access tokens de Afip SDK.
3. Totales, IVA, saldos y elegibilidad de emisión se **muestran** desde respuestas del backend; no se recalcula la verdad fiscal solo en el cliente.
4. Un solo rol visible: **Admin**. No hay UI de roles/permisos granulares en MVP.
5. Ambiente fiscal activo (**homologación** vs **producción**) siempre visible en UI.
6. Indicadores mínimos: error ARCA y config fiscal incompleta.
7. Homologación es el ambiente por defecto para probar facturación E2E antes de producción.
8. Respetar estados de dominio del PRD (cliente, borrador, comprobante, emisor, pago, email).
9. Ante timeout/ARCA caído: CRM y consulta de autorizados siguen usables; emisión muestra error técnico controlado.
10. No implementar features post-MVP (multi-empresa UI, roles, KPI-heavy, export, WhatsApp, etc.).

---

## Dependencias del backend (contrato)

El FE consume las operaciones documentadas en [ROADMAP-BACKEND.md](./ROADMAP-BACKEND.md) § “Contratos que el frontend consume”.

**Reglas de consumo:**

* Toda mutación sensible pasa por Server Action / API (no writes directos a tablas con secretos).
* Errores tipados: `validation_error`, `business_rule`, `fiscal_rejected`, `fiscal_technical_error`, `conflict`, `unauthorized`.
* Confirmaciones Admin explícitas cuando el backend lo exige (crédito excedido, override cliente, activación producción, override NC).

**Estados a representar en UI (alineados al PRD):**

* Emisor: `incomplete` · `validated_homologation` · `production_ready` · `error`
* Cliente: `activo` · `inactivo` · `bloqueado`
* Borrador: `draft` · `emitting` · `issued` · `rejected` · `cancelled`
* Comprobante: `authorized` · `rejected` · `technical_error`
* Pago factura: `pending` · `partial` · `paid` · `overdue`
* Email: `not_sent` · `sent` · `failed` · `resent`

---

## Hitos de integración compartidos

| ID | Checkpoint | Semana aprox. | Frontend listo cuando… | Backend listo cuando… |
| --- | --- | --- | --- | --- |
| **H1** | CRM usable | fin Fase 1 | Login + pantallas CRM operables | Auth Admin + ABM CRM + auditoría base |
| **H2** | Comercial + finanzas internas | fin Fase 2 | UI de conceptos, borradores, CC y pagos | Conceptos, borradores, CC, pagos sin ARCA |
| **H3** | Flujo ARCA homologación E2E | fin Fase 3 | Config fiscal segura + emisión/reintentos/NC | Emisión A/B/C + NC con CAE; saldo solo si autorizado |
| **H4** | Producción controlada | fin Fase 4 | PDF, email manual, confirmación prod, badges | PDF, email, hardening, activación prod |

---

## Shell de aplicación (transversal)

* Layout autenticado Admin (nav: Clientes, Conceptos, Borradores/Comprobantes, Cobros, Config fiscal, Auditoría).
* Badge de **ambiente fiscal** (homologación / producción) siempre visible.
* Banner/alerta: config fiscal incompleta; error ARCA reciente.
* Estados UI estándar: loading, empty, validation, error de red, error de negocio.
* Sin menús de roles ni multi-empresa en MVP.

---

## Fase 1 — Base y CRM (sem. 1–2)

**Objetivo PRD:** app base + login Admin + ABM clientes/contactos/direcciones + búsqueda simple.  
**Trazabilidad PRD:** §§ 5, 6.2, 6.8, 11 (CRM).

### Tareas de UI

1. **Auth**
   * Pantalla de login; manejo de sesión; logout.
   * Mensajes claros ante rate limit / bloqueo temporal.
   * Redirección de rutas privadas si no hay sesión Admin.
2. **Clientes**
   * Listado paginado + búsqueda simple (texto: razón social, CUIT, email).
   * Crear / editar / consultar detalle.
   * Campos: tipo persona/empresa, razón social/nombre, nombre comercial opcional, documento, condición fiscal, email/teléfono, estado, observaciones, límite de crédito opcional, vendedor asignado opcional.
   * Estados visuales: `activo` · `inactivo` · `bloqueado`.
3. **Contactos**
   * Alta/edición múltiples contactos.
   * Marcar **un** principal y **un** de facturación (UI refleja regla; backend enforce).
   * Si no hay contacto de facturación: indicar que se usará email principal del cliente.
4. **Dirección fiscal**
   * Formulario de domicilio fiscal (comercial opcional si se incluye en MVP de datos).
5. **Auditoría (lectura)**
   * Vista mínima filtrable por cliente/usuario/entidad/fecha (solo lectura; sin editar/borrar).

### Estados UI a cubrir

* Empty: “Sin clientes”.
* Validation: documento inválido, campos obligatorios.
* Loading en listados y guardado.
* Error de red / unauthorized.

### Dependencias del backend

* Contrato operativo: [CONTRATO-FRONTEND.md](./CONTRATO-FRONTEND.md).
* Requiere H1 backend: auth + CRUD CRM + audit read.
* No bloquear esta fase por ausencia de ARCA.

### Criterios de salida (frontend)

* [ ] Admin inicia sesión y opera solo rutas autorizadas.
* [ ] ABM clientes/contactos/direcciones usable.
* [ ] Búsqueda simple y paginación.
* [ ] Auditoría consultable (solo lectura).
* [ ] Sin pantallas de emisión ni secretos fiscales.

### Entregable

**CRM usable por Admin sin emisión** (H1).

---

## Fase 2 — Comercial y financiero interno (sem. 3–4)

**Objetivo PRD:** conceptos, borradores, totales, límite de crédito, CC, pagos e imputación — **sin emitir a ARCA**.  
**Trazabilidad PRD:** §§ 6.3, 6.6, 8, 11 (Finanzas).

### Tareas de UI

1. **Conceptos facturables**
   * ABM: código, nombre, descripción, tipo producto/servicio, precio ARS, alícuota IVA, estado.
   * Sin listas de precios (excluido post-MVP).
2. **Borradores**
   * Crear/editar borrador: cliente, contacto facturación, PV (según config disponible o placeholder hasta Fase 3), tipo/letra sugeridos, fechas, concepto ARCA (productos/servicios/ambos), ítems, observaciones.
   * Al cambiar ítems: pedir recalcular al backend y mostrar subtotales/IVA/total **devueltos**.
   * Estados visibles: al menos `draft` / `cancelled`; preparar UI para `emitting` / `issued` / `rejected`.
   * Acción “Validar” / “Listo para emitir” que muestre errores de negocio (cliente inactivo/bloqueado, datos fiscales, crédito).
   * Si crédito excedido: diálogo de **confirmación Admin** (override) según respuesta backend.
3. **Cuenta corriente**
   * Vista por cliente: movimientos, saldo, vencido.
   * Estados de pago de factura: `pending` · `partial` · `paid` · `overdue`.
   * Dejar claro: rechazo fiscal no genera deuda (mensaje informativo cuando aplique en Fase 3).
4. **Pagos e imputaciones**
   * Registrar pago: fecha, monto, moneda, método (efectivo / transferencia / cheque / tarjeta / otro), referencia, notas.
   * Imputar 1 pago → 1 o N facturas; parcial permitido.
   * **No** auto-seleccionar “la más antigua”; el Admin elige.
   * Bloquear imputar por encima del pendiente (mensaje `business_rule`).
   * Deshacer imputación con confirmación + motivo si el backend lo pide.
   * Distinguir visualmente: pago registrado vs factura saldada.

### Estados UI a cubrir

* Totales “calculando…” mientras responde el server.
* Empty: sin conceptos / sin borradores / CC en cero.
* Confirmaciones destructivas (cancelar borrador, deshacer imputación).
* Warnings de crédito y cliente no emitible.

### Dependencias del backend

* Requiere H2: conceptos, borradores+totales, pagos, imputaciones, movimientos.
* Emisión real permanece deshabilitada o no visible hasta H3.

### Criterios de salida (frontend)

* [ ] ABM conceptos y borradores con totales coherentes (server).
* [ ] Validaciones pre-emisión visibles sin llamar ARCA.
* [ ] CC, pagos e imputaciones usables; reverso con confirmación.
* [ ] No hay edición manual de saldos en UI.

### Entregable

**Borradores y deuda/pagos sin ARCA** (H2).

---

## Fase 3 — ARCA homologación (sem. 5–6)

**Objetivo PRD:** config emisor (sin secretos en cliente), emisión A/B/C en homologación, estados/errores/reintentos, NC básica; flujo de prueba E2E.  
**Trazabilidad PRD:** §§ 6.1, 6.4, 6.7, 11 (Facturación), 14.2–14.6.

### Tareas de UI

1. **Configuración fiscal del emisor**
   * Formulario de datos públicos: razón social, CUIT, condición IVA, domicilio, IIBB, inicio actividades, email, logo, PV, ambiente.
   * Upload de certificado/clave: el archivo se envía al backend; la UI **no** previsualiza ni relee el contenido secreto; solo muestra “credencial cargada / pendiente / error”.
   * Estados emisor y última validación visibles.
   * Validar homologación; bloqueo visual de emisión si `incomplete` o `error`.
   * Confirmación explícita reservada para producción (Fase 4); en Fase 3 operar en homologación.
2. **Emisión**
   * Desde borrador válido: botón Emitir (solo Admin).
   * Anti doble-click: disable + loading mientras `emitting`.
   * Mostrar resultado:
     * **Autorizado:** CAE, vencimiento, PV, número; enlace a comprobante; indicar impacto en CC.
     * **Rechazado:** mensaje ARCA; sin impacto saldo; permitir corregir borrador/reintentar según reglas.
     * **Error técnico:** mensaje controlado; acciones Reconsultar / Reintentar (sin “reemitir a ciegas”).
   * Listado de intentos de emisión (historial del borrador/comprobante).
3. **Comprobantes**
   * Detalle de factura autorizada: **solo lectura** (inmutable).
   * Indicador de ambiente del comprobante.
4. **Nota de crédito**
   * Flujo asociar a factura autorizada; montos; override Admin si aplica.
   * Estados y CAE propios; feedback de CC.
5. **Indicadores**
   * Badge ambiente; alerta config incompleta; alerta error ARCA.

### Estados UI a cubrir

* `emitting` con spinner y bloqueo de reenvío.
* `fiscal_rejected` vs `fiscal_technical_error` con CTAs distintos.
* `conflict` (duplicación/idempotency) con mensaje claro.
* Empty/disabled emit si config inválida.

### Dependencias del backend

* Requiere H3: config cifrada, adapter, emisión, anti-duplicación, NC, movimientos post-CAE.
* PDF/email pueden mostrar “próximamente” o deshabilitado hasta H4.

### Criterios de salida (frontend)

* [ ] Admin configura emisor sin ver secretos.
* [ ] Flujo E2E en UI: config → cliente → borrador → emisión → CAE → CC (PDF opcional stub).
* [ ] Rechazo/error técnico sin sugerir que hubo deuda.
* [ ] NC básica operable en homologación.
* [ ] Ambiente homologación visible y por defecto.

### Entregable

**Flujo de prueba de facturación operable por Admin en homologación** (H3).

---

## Fase 4 — PDF, email, producción controlada (sem. 7–8)

**Objetivo PRD:** descarga PDF, email manual, confirmación de producción, hardening de UX, indicadores finales.  
**Trazabilidad PRD:** §§ 6.5, 11, 14.6, 16.

### Tareas de UI

1. **PDF**
   * Descargar/ver PDF solo si autorizado (o válido en homologación).
   * Estados: generando / disponible / error.
2. **Email manual**
   * Botón “Enviar / Reenviar” al contacto de facturación.
   * Mostrar estado `not_sent` · `sent` · `failed` · `resent` y último error si `failed`.
   * Sin toggle de “envío automático”.
3. **Producción controlada**
   * Flujo de activación con confirmación explícita (copy claro + disclaimer fiscal).
   * Tras activar: badge producción; seguir mostrando riesgos/mitigaciones.
   * Homologación sigue accesible según reglas de backend.
4. **Hardening UX**
   * Revisar todos los empty/loading/error.
   * Prevenir doble submit en emisión, pagos, email, cambio de ambiente.
   * Asegurar que comprobantes autorizados no tengan controles de edición.
5. **Doc / ayuda in-app mínima (opcional)**
   * Enlaces a doc operativa / disclaimer; no reemplaza asesor fiscal.

### Estados UI a cubrir

* Confirmación modal de producción (irreversible o de alto impacto).
* Email failed con reintento.
* PDF no disponible aún vs error real.

### Dependencias del backend

* Requiere H4: PDF Storage, email_logs, endpoint activación producción, APIs de descarga/envío.

### Criterios de salida (frontend)

* [ ] PDF descargable desde UI.
* [ ] Email manual con feedback de estado.
* [ ] Activación producción solo con confirmación explícita.
* [ ] Indicadores de ambiente, config incompleta y error ARCA presentes.
* [ ] Flujo completo usable para casos simples (sujeto a validación fiscal externa).

### Entregable

**Flujo completo listo para casos simples en producción** (H4).

---

## Fuera de alcance (post-MVP) — no implementar en este roadmap

UI multi-empresa · roles Operador/Lector/etc. · dashboard KPI-heavy · buscador avanzado · export CSV/Excel · alertas automáticas · WhatsApp · listas de precios · interacciones CRM · documentos con vencimiento · multi-POS en UI · padrón ARCA · app mobile.

---

## Checklist de coherencia con el backend

| Fase | Frontend entrega | Backend debe exponer |
| --- | --- | --- |
| 1 | Login, ABM CRM, audit read | Auth Admin, CRM, audit_logs |
| 2 | Conceptos, borradores, CC, pagos | Totales server, movimientos, imputaciones |
| 3 | Config sin secretos, emitir/NC | Adapter ARCA, CAE, anti-duplicación, CC post-auth |
| 4 | PDF, email, confirmación prod | Storage, email_logs, activación prod |

---

*Versión alineada al PRD 3.2 — MVP Lean (solo Admin; Supabase Auth/Storage + Prisma).*
