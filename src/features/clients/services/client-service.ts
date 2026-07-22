import { Prisma } from "@/generated/prisma/client";

import { recordAudit } from "@/features/audit/services/audit-service";
import type { AdminSession } from "@/features/auth/services/require-admin";
import {
  createAddressSchema,
  createClientSchema,
  createContactSchema,
  listClientsSchema,
  softDeleteClientSchema,
  updateAddressSchema,
  updateClientSchema,
  updateContactSchema,
  entityIdSchema,
  type CreateAddressInput,
  type CreateClientInput,
  type CreateContactInput,
  type ListClientsInput,
  type UpdateAddressInput,
  type UpdateClientInput,
  type UpdateContactInput,
} from "@/features/clients/schemas/client-schemas";
import { getActiveIssuerProfileId } from "@/features/issuer-profile/services/issuer-profile-service";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  documentValidationMessage,
  isValidDocument,
  normalizeDocumentNumber,
  type DocumentTypeInput,
} from "@/lib/document";
import { prisma } from "@/lib/prisma";
import { zodErrorToResult } from "@/lib/zod-error";

const MAX_CONTACTS_PER_CLIENT = 50;
const MAX_ADDRESSES_PER_CLIENT = 20;
const LIST_NESTED_TAKE = 20;

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return value;
}

async function assertAssignedUserExists(
  assignedUserId: string | null | undefined,
): Promise<ActionResult<string | null> | null> {
  if (assignedUserId === undefined) {
    return null;
  }
  const normalized = emptyToNull(assignedUserId);
  if (!normalized) {
    return ok(null);
  }
  const user = await prisma.user.findUnique({ where: { id: normalized } });
  if (!user) {
    return fail("validation_error", "Usuario asignado inexistente", {
      assignedUserId: ["Usuario asignado inexistente"],
    });
  }
  return ok(normalized);
}

async function assertDocumentAvailable(input: {
  documentType: DocumentTypeInput;
  documentNumber: string;
  excludeClientId?: string;
}): Promise<ActionResult<never> | null> {
  const duplicate = await prisma.client.findFirst({
    where: {
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      deletedAt: null,
      ...(input.excludeClientId
        ? { id: { not: input.excludeClientId } }
        : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    return fail(
      "conflict",
      "Ya existe un cliente activo con ese documento",
      { documentNumber: ["Documento ya registrado"] },
    );
  }
  return null;
}

function toClientDto(client: {
  id: string;
  issuerProfileId: string;
  type: string;
  legalName: string;
  tradeName: string | null;
  documentType: string;
  documentNumber: string;
  taxCondition: string;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  creditLimit: Prisma.Decimal | null;
  assignedUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  contacts?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
    isBilling: boolean;
    notes: string | null;
  }>;
  addresses?: Array<{
    id: string;
    kind: string;
    street: string;
    number: string | null;
    floor: string | null;
    apartment: string | null;
    city: string;
    state: string;
    postalCode: string | null;
    country: string;
    notes: string | null;
  }>;
}) {
  const contacts = (client.contacts ?? []).map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    isPrimary: c.isPrimary,
    isBilling: c.isBilling,
    notes: c.notes,
  }));

  const hasBillingContact = contacts.some((c) => c.isBilling);

  return {
    id: client.id,
    issuerProfileId: client.issuerProfileId,
    type: client.type,
    legalName: client.legalName,
    tradeName: client.tradeName,
    documentType: client.documentType,
    documentNumber: client.documentNumber,
    taxCondition: client.taxCondition,
    email: client.email,
    phone: client.phone,
    status: client.status,
    notes: client.notes,
    creditLimit: client.creditLimit
      ? Number(client.creditLimit)
      : null,
    assignedUserId: client.assignedUserId,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    contacts,
    addresses: (client.addresses ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      street: a.street,
      number: a.number,
      floor: a.floor,
      apartment: a.apartment,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      notes: a.notes,
    })),
    billingEmailFallback: !hasBillingContact,
    billingEmail: hasBillingContact
      ? contacts.find((c) => c.isBilling)?.email ?? null
      : client.email,
  };
}

async function auditSensitiveClientChanges(input: {
  session: AdminSession;
  clientId: string;
  before: {
    documentNumber: string;
    taxCondition: string;
    creditLimit: Prisma.Decimal | null;
  };
  after: {
    documentNumber: string;
    taxCondition: string;
    creditLimit: Prisma.Decimal | null;
  };
}) {
  const fields: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }> = [];

  if (input.before.documentNumber !== input.after.documentNumber) {
    fields.push({
      field: "documentNumber",
      oldValue: input.before.documentNumber,
      newValue: input.after.documentNumber,
    });
  }
  if (input.before.taxCondition !== input.after.taxCondition) {
    fields.push({
      field: "taxCondition",
      oldValue: input.before.taxCondition,
      newValue: input.after.taxCondition,
    });
  }
  const beforeLimit = input.before.creditLimit
    ? Number(input.before.creditLimit)
    : null;
  const afterLimit = input.after.creditLimit
    ? Number(input.after.creditLimit)
    : null;
  if (beforeLimit !== afterLimit) {
    fields.push({
      field: "creditLimit",
      oldValue: beforeLimit,
      newValue: afterLimit,
    });
  }

  for (const change of fields) {
    await recordAudit({
      userId: input.session.user.id,
      clientId: input.clientId,
      entity: "client",
      entityId: input.clientId,
      action: "update",
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
    });
  }
}

export async function listClients(
  session: AdminSession,
  raw: ListClientsInput,
): Promise<
  ActionResult<{
    items: ReturnType<typeof toClientDto>[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>
> {
  void session;
  const parsed = listClientsSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 20;
  const q = parsed.data.q?.trim();

  const where: Prisma.ClientWhereInput = {
    deletedAt: null,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(q
      ? {
          OR: [
            { legalName: { contains: q, mode: "insensitive" } },
            { tradeName: { contains: q, mode: "insensitive" } },
            { documentNumber: { contains: normalizeDocumentNumber(q) } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { legalName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contacts: {
          where: { deletedAt: null },
          take: LIST_NESTED_TAKE,
          orderBy: { createdAt: "asc" },
        },
        addresses: {
          where: { deletedAt: null },
          take: LIST_NESTED_TAKE,
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return ok({
    items: rows.map(toClientDto),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}

export async function getClient(
  session: AdminSession,
  id: string,
): Promise<ActionResult<ReturnType<typeof toClientDto>>> {
  void session;
  const parsedId = entityIdSchema.safeParse(id);
  if (!parsedId.success) {
    return zodErrorToResult(parsedId.error);
  }

  const client = await prisma.client.findFirst({
    where: { id: parsedId.data, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: LIST_NESTED_TAKE,
      },
      addresses: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: LIST_NESTED_TAKE,
      },
    },
  });

  if (!client) {
    return fail("not_found", "Cliente no encontrado");
  }

  return ok(toClientDto(client));
}

export async function createClient(
  session: AdminSession,
  raw: CreateClientInput,
): Promise<ActionResult<ReturnType<typeof toClientDto>>> {
  const parsed = createClientSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  const documentType = parsed.data.documentType as DocumentTypeInput;
  const documentNumber = normalizeDocumentNumber(parsed.data.documentNumber);
  if (!isValidDocument(documentType, documentNumber)) {
    return fail("validation_error", documentValidationMessage(documentType), {
      documentNumber: [documentValidationMessage(documentType)],
    });
  }

  const docConflict = await assertDocumentAvailable({
    documentType,
    documentNumber,
  });
  if (docConflict) {
    return docConflict;
  }

  const issuerProfileId = await getActiveIssuerProfileId();
  if (!issuerProfileId) {
    return fail(
      "business_rule",
      "No hay emisor activo configurado (issuer_profile)",
    );
  }

  const assigned = await assertAssignedUserExists(parsed.data.assignedUserId);
  if (assigned && !assigned.ok) {
    return assigned;
  }

  const client = await prisma.client.create({
    data: {
      issuerProfileId,
      type: parsed.data.type,
      legalName: parsed.data.legalName,
      tradeName: emptyToNull(parsed.data.tradeName),
      documentType,
      documentNumber,
      taxCondition: parsed.data.taxCondition,
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      status: parsed.data.status,
      notes: emptyToNull(parsed.data.notes),
      creditLimit:
        parsed.data.creditLimit === undefined ||
        parsed.data.creditLimit === null
          ? null
          : new Prisma.Decimal(parsed.data.creditLimit),
      assignedUserId: assigned?.ok ? assigned.data : null,
    },
    include: {
      contacts: true,
      addresses: true,
    },
  });

  await recordAudit({
    userId: session.user.id,
    clientId: client.id,
    entity: "client",
    entityId: client.id,
    action: "create",
    newValue: {
      legalName: client.legalName,
      documentNumber: client.documentNumber,
      status: client.status,
    },
  });

  return ok(toClientDto(client));
}

export async function updateClient(
  session: AdminSession,
  raw: UpdateClientInput,
): Promise<ActionResult<ReturnType<typeof toClientDto>>> {
  const parsed = updateClientSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  const existing = await prisma.client.findFirst({
    where: { id: parsed.data.id, deletedAt: null },
  });
  if (!existing) {
    return fail("not_found", "Cliente no encontrado");
  }

  const nextDocumentType = (parsed.data.documentType ??
    existing.documentType) as DocumentTypeInput;
  const nextDocumentNumber =
    parsed.data.documentNumber !== undefined
      ? normalizeDocumentNumber(parsed.data.documentNumber)
      : existing.documentNumber;

  if (!isValidDocument(nextDocumentType, nextDocumentNumber)) {
    return fail(
      "validation_error",
      documentValidationMessage(nextDocumentType),
      {
        documentNumber: [documentValidationMessage(nextDocumentType)],
      },
    );
  }

  const docConflict = await assertDocumentAvailable({
    documentType: nextDocumentType,
    documentNumber: nextDocumentNumber,
    excludeClientId: existing.id,
  });
  if (docConflict) {
    return docConflict;
  }

  const assigned = await assertAssignedUserExists(parsed.data.assignedUserId);
  if (assigned && !assigned.ok) {
    return assigned;
  }

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      ...(parsed.data.legalName !== undefined
        ? { legalName: parsed.data.legalName }
        : {}),
      ...(parsed.data.tradeName !== undefined
        ? { tradeName: emptyToNull(parsed.data.tradeName) }
        : {}),
      documentType: nextDocumentType,
      documentNumber: nextDocumentNumber,
      ...(parsed.data.taxCondition !== undefined
        ? { taxCondition: parsed.data.taxCondition }
        : {}),
      ...(parsed.data.email !== undefined
        ? { email: emptyToNull(parsed.data.email) }
        : {}),
      ...(parsed.data.phone !== undefined
        ? { phone: emptyToNull(parsed.data.phone) }
        : {}),
      ...(parsed.data.status !== undefined
        ? { status: parsed.data.status }
        : {}),
      ...(parsed.data.notes !== undefined
        ? { notes: emptyToNull(parsed.data.notes) }
        : {}),
      ...(parsed.data.creditLimit !== undefined
        ? {
            creditLimit:
              parsed.data.creditLimit === null
                ? null
                : new Prisma.Decimal(parsed.data.creditLimit),
          }
        : {}),
      ...(assigned
        ? { assignedUserId: assigned.data }
        : {}),
    },
    include: {
      contacts: {
        where: { deletedAt: null },
        take: LIST_NESTED_TAKE,
        orderBy: { createdAt: "asc" },
      },
      addresses: {
        where: { deletedAt: null },
        take: LIST_NESTED_TAKE,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  await auditSensitiveClientChanges({
    session,
    clientId: client.id,
    before: {
      documentNumber: existing.documentNumber,
      taxCondition: existing.taxCondition,
      creditLimit: existing.creditLimit,
    },
    after: {
      documentNumber: client.documentNumber,
      taxCondition: client.taxCondition,
      creditLimit: client.creditLimit,
    },
  });

  await recordAudit({
    userId: session.user.id,
    clientId: client.id,
    entity: "client",
    entityId: client.id,
    action: "update",
  });

  return ok(toClientDto(client));
}

export async function softDeleteClient(
  session: AdminSession,
  id: string,
  reason?: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = softDeleteClientSchema.safeParse({ id, reason });
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  const existing = await prisma.client.findFirst({
    where: { id: parsed.data.id, deletedAt: null },
  });
  if (!existing) {
    return fail("not_found", "Cliente no encontrado");
  }

  await prisma.client.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date(), status: "inactivo" },
  });

  await recordAudit({
    userId: session.user.id,
    clientId: parsed.data.id,
    entity: "client",
    entityId: parsed.data.id,
    action: "delete",
    reason: emptyToNull(parsed.data.reason),
  });

  return ok({ id: parsed.data.id });
}

export async function createContact(
  session: AdminSession,
  raw: CreateContactInput,
): Promise<ActionResult<ReturnType<typeof toClientDto>["contacts"][number]>> {
  const parsed = createContactSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, deletedAt: null },
  });
  if (!client) {
    return fail("not_found", "Cliente no encontrado");
  }

  const contactCount = await prisma.clientContact.count({
    where: { clientId: client.id, deletedAt: null },
  });
  if (contactCount >= MAX_CONTACTS_PER_CLIENT) {
    return fail(
      "business_rule",
      `Máximo ${MAX_CONTACTS_PER_CLIENT} contactos por cliente`,
    );
  }

  const contact = await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.clientContact.updateMany({
        where: {
          clientId: client.id,
          isPrimary: true,
          deletedAt: null,
        },
        data: { isPrimary: false },
      });
    }
    if (parsed.data.isBilling) {
      await tx.clientContact.updateMany({
        where: {
          clientId: client.id,
          isBilling: true,
          deletedAt: null,
        },
        data: { isBilling: false },
      });
    }

    return tx.clientContact.create({
      data: {
        clientId: client.id,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: emptyToNull(parsed.data.email),
        phone: emptyToNull(parsed.data.phone),
        isPrimary: parsed.data.isPrimary ?? false,
        isBilling: parsed.data.isBilling ?? false,
        notes: emptyToNull(parsed.data.notes),
      },
    });
  });

  await recordAudit({
    userId: session.user.id,
    clientId: client.id,
    entity: "client_contact",
    entityId: contact.id,
    action: "create",
    newValue: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      isPrimary: contact.isPrimary,
      isBilling: contact.isBilling,
    },
  });

  return ok({
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    isPrimary: contact.isPrimary,
    isBilling: contact.isBilling,
    notes: contact.notes,
  });
}

export async function updateContact(
  session: AdminSession,
  raw: UpdateContactInput,
): Promise<ActionResult<ReturnType<typeof toClientDto>["contacts"][number]>> {
  const parsed = updateContactSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  const existing = await prisma.clientContact.findFirst({
    where: { id: parsed.data.id, deletedAt: null },
    include: { client: { select: { deletedAt: true } } },
  });
  if (!existing || existing.client.deletedAt) {
    return fail("not_found", "Contacto no encontrado");
  }

  const contact = await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary === true) {
      await tx.clientContact.updateMany({
        where: {
          clientId: existing.clientId,
          isPrimary: true,
          deletedAt: null,
          id: { not: existing.id },
        },
        data: { isPrimary: false },
      });
    }
    if (parsed.data.isBilling === true) {
      await tx.clientContact.updateMany({
        where: {
          clientId: existing.clientId,
          isBilling: true,
          deletedAt: null,
          id: { not: existing.id },
        },
        data: { isBilling: false },
      });
    }

    return tx.clientContact.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.firstName !== undefined
          ? { firstName: parsed.data.firstName }
          : {}),
        ...(parsed.data.lastName !== undefined
          ? { lastName: parsed.data.lastName }
          : {}),
        ...(parsed.data.email !== undefined
          ? { email: emptyToNull(parsed.data.email) }
          : {}),
        ...(parsed.data.phone !== undefined
          ? { phone: emptyToNull(parsed.data.phone) }
          : {}),
        ...(parsed.data.isPrimary !== undefined
          ? { isPrimary: parsed.data.isPrimary }
          : {}),
        ...(parsed.data.isBilling !== undefined
          ? { isBilling: parsed.data.isBilling }
          : {}),
        ...(parsed.data.notes !== undefined
          ? { notes: emptyToNull(parsed.data.notes) }
          : {}),
      },
    });
  });

  await recordAudit({
    userId: session.user.id,
    clientId: existing.clientId,
    entity: "client_contact",
    entityId: contact.id,
    action: "update",
  });

  return ok({
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    isPrimary: contact.isPrimary,
    isBilling: contact.isBilling,
    notes: contact.notes,
  });
}

export async function softDeleteContact(
  session: AdminSession,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const parsedId = entityIdSchema.safeParse(id);
  if (!parsedId.success) {
    return zodErrorToResult(parsedId.error);
  }

  const existing = await prisma.clientContact.findFirst({
    where: { id: parsedId.data, deletedAt: null },
    include: { client: { select: { deletedAt: true } } },
  });
  if (!existing || existing.client.deletedAt) {
    return fail("not_found", "Contacto no encontrado");
  }

  await prisma.clientContact.update({
    where: { id: parsedId.data },
    data: {
      deletedAt: new Date(),
      isPrimary: false,
      isBilling: false,
    },
  });

  await recordAudit({
    userId: session.user.id,
    clientId: existing.clientId,
    entity: "client_contact",
    entityId: parsedId.data,
    action: "delete",
  });

  return ok({ id: parsedId.data });
}

export async function createAddress(
  session: AdminSession,
  raw: CreateAddressInput,
): Promise<ActionResult<ReturnType<typeof toClientDto>["addresses"][number]>> {
  const parsed = createAddressSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, deletedAt: null },
  });
  if (!client) {
    return fail("not_found", "Cliente no encontrado");
  }

  const addressCount = await prisma.clientAddress.count({
    where: { clientId: client.id, deletedAt: null },
  });
  if (addressCount >= MAX_ADDRESSES_PER_CLIENT) {
    return fail(
      "business_rule",
      `Máximo ${MAX_ADDRESSES_PER_CLIENT} direcciones por cliente`,
    );
  }

  const address = await prisma.clientAddress.create({
    data: {
      clientId: client.id,
      kind: parsed.data.kind,
      street: parsed.data.street,
      number: emptyToNull(parsed.data.number),
      floor: emptyToNull(parsed.data.floor),
      apartment: emptyToNull(parsed.data.apartment),
      city: parsed.data.city,
      state: parsed.data.state,
      postalCode: emptyToNull(parsed.data.postalCode),
      country: parsed.data.country || "AR",
      notes: emptyToNull(parsed.data.notes),
    },
  });

  await recordAudit({
    userId: session.user.id,
    clientId: client.id,
    entity: "client_address",
    entityId: address.id,
    action: "create",
    newValue: { kind: address.kind, city: address.city },
  });

  return ok({
    id: address.id,
    kind: address.kind,
    street: address.street,
    number: address.number,
    floor: address.floor,
    apartment: address.apartment,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    notes: address.notes,
  });
}

export async function updateAddress(
  session: AdminSession,
  raw: UpdateAddressInput,
): Promise<ActionResult<ReturnType<typeof toClientDto>["addresses"][number]>> {
  const parsed = updateAddressSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  const existing = await prisma.clientAddress.findFirst({
    where: { id: parsed.data.id, deletedAt: null },
    include: { client: { select: { deletedAt: true } } },
  });
  if (!existing || existing.client.deletedAt) {
    return fail("not_found", "Dirección no encontrada");
  }

  const address = await prisma.clientAddress.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.kind !== undefined ? { kind: parsed.data.kind } : {}),
      ...(parsed.data.street !== undefined
        ? { street: parsed.data.street }
        : {}),
      ...(parsed.data.number !== undefined
        ? { number: emptyToNull(parsed.data.number) }
        : {}),
      ...(parsed.data.floor !== undefined
        ? { floor: emptyToNull(parsed.data.floor) }
        : {}),
      ...(parsed.data.apartment !== undefined
        ? { apartment: emptyToNull(parsed.data.apartment) }
        : {}),
      ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
      ...(parsed.data.state !== undefined ? { state: parsed.data.state } : {}),
      ...(parsed.data.postalCode !== undefined
        ? { postalCode: emptyToNull(parsed.data.postalCode) }
        : {}),
      ...(parsed.data.country !== undefined
        ? { country: parsed.data.country }
        : {}),
      ...(parsed.data.notes !== undefined
        ? { notes: emptyToNull(parsed.data.notes) }
        : {}),
    },
  });

  await recordAudit({
    userId: session.user.id,
    clientId: existing.clientId,
    entity: "client_address",
    entityId: address.id,
    action: "update",
  });

  return ok({
    id: address.id,
    kind: address.kind,
    street: address.street,
    number: address.number,
    floor: address.floor,
    apartment: address.apartment,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    notes: address.notes,
  });
}

export async function softDeleteAddress(
  session: AdminSession,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const parsedId = entityIdSchema.safeParse(id);
  if (!parsedId.success) {
    return zodErrorToResult(parsedId.error);
  }

  const existing = await prisma.clientAddress.findFirst({
    where: { id: parsedId.data, deletedAt: null },
    include: { client: { select: { deletedAt: true } } },
  });
  if (!existing || existing.client.deletedAt) {
    return fail("not_found", "Dirección no encontrada");
  }

  await prisma.clientAddress.update({
    where: { id: parsedId.data },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    userId: session.user.id,
    clientId: existing.clientId,
    entity: "client_address",
    entityId: parsedId.data,
    action: "delete",
  });

  return ok({ id: parsedId.data });
}

/** Exported for tests: enforce at most one primary and one billing contact. */
export async function assertContactUniquenessRules(clientId: string) {
  const contacts = await prisma.clientContact.findMany({
    where: { clientId, deletedAt: null },
  });
  const primaryCount = contacts.filter((c) => c.isPrimary).length;
  const billingCount = contacts.filter((c) => c.isBilling).length;
  return { primaryCount, billingCount, ok: primaryCount <= 1 && billingCount <= 1 };
}
