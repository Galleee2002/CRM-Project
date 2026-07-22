"use server";

import {
  requireAdmin,
  type AdminSession,
} from "@/features/auth/services/require-admin";
import type {
  CreateAddressInput,
  CreateClientInput,
  CreateContactInput,
  ListClientsInput,
  UpdateAddressInput,
  UpdateClientInput,
  UpdateContactInput,
} from "@/features/clients/schemas/client-schemas";
import * as clientService from "@/features/clients/services/client-service";
import { fail, type ActionResult } from "@/lib/action-result";

async function withAdminAction<T>(
  run: (session: AdminSession) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth;
  }
  try {
    return await run(auth.data);
  } catch {
    return fail("business_rule", "No se pudo completar la operación");
  }
}

export async function listClientsAction(input: ListClientsInput = {}) {
  return withAdminAction((session) =>
    clientService.listClients(session, input),
  );
}

export async function getClientAction(id: string) {
  return withAdminAction((session) => clientService.getClient(session, id));
}

export async function createClientAction(input: CreateClientInput) {
  return withAdminAction((session) =>
    clientService.createClient(session, input),
  );
}

export async function updateClientAction(input: UpdateClientInput) {
  return withAdminAction((session) =>
    clientService.updateClient(session, input),
  );
}

export async function softDeleteClientAction(id: string, reason?: string) {
  return withAdminAction((session) =>
    clientService.softDeleteClient(session, id, reason),
  );
}

export async function createContactAction(input: CreateContactInput) {
  return withAdminAction((session) =>
    clientService.createContact(session, input),
  );
}

export async function updateContactAction(input: UpdateContactInput) {
  return withAdminAction((session) =>
    clientService.updateContact(session, input),
  );
}

export async function softDeleteContactAction(id: string) {
  return withAdminAction((session) =>
    clientService.softDeleteContact(session, id),
  );
}

export async function createAddressAction(input: CreateAddressInput) {
  return withAdminAction((session) =>
    clientService.createAddress(session, input),
  );
}

export async function updateAddressAction(input: UpdateAddressInput) {
  return withAdminAction((session) =>
    clientService.updateAddress(session, input),
  );
}

export async function softDeleteAddressAction(id: string) {
  return withAdminAction((session) =>
    clientService.softDeleteAddress(session, id),
  );
}
