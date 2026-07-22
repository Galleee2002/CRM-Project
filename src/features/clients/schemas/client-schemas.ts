import { z } from "zod";

export const clientStatusSchema = z.enum(["activo", "inactivo", "bloqueado"]);
export const clientTypeSchema = z.enum(["persona", "empresa"]);
export const documentTypeSchema = z.enum(["CUIT", "CUIL", "DNI"]);
export const addressKindSchema = z.enum(["fiscal", "comercial"]);

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .email("Email inválido")
  .optional()
  .nullable()
  .or(z.literal(""));

export const entityIdSchema = z
  .string()
  .trim()
  .min(1, "Id inválido")
  .max(64, "Id inválido");

export const createClientSchema = z.object({
  type: clientTypeSchema,
  legalName: z
    .string()
    .trim()
    .min(1, "La razón social / nombre es obligatorio")
    .max(200),
  tradeName: z.string().trim().max(200).optional().nullable(),
  documentType: documentTypeSchema,
  documentNumber: z
    .string()
    .trim()
    .min(1, "El documento es obligatorio")
    .max(20),
  taxCondition: z
    .string()
    .trim()
    .min(1, "La condición fiscal es obligatoria")
    .max(100),
  email: optionalEmail,
  phone: z.string().trim().max(40).optional().nullable(),
  status: clientStatusSchema.default("activo"),
  notes: z.string().max(2000).optional().nullable(),
  creditLimit: z.number().nonnegative().optional().nullable(),
  assignedUserId: entityIdSchema.optional().nullable(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  id: entityIdSchema,
});

export const listClientsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: clientStatusSchema.optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export const softDeleteClientSchema = z.object({
  id: entityIdSchema,
  reason: z.string().trim().max(500).optional().nullable(),
});

export const createContactSchema = z.object({
  clientId: entityIdSchema,
  firstName: z.string().trim().min(1, "Nombre obligatorio").max(100),
  lastName: z.string().trim().min(1, "Apellido obligatorio").max(100),
  email: optionalEmail,
  phone: z.string().trim().max(40).optional().nullable(),
  isPrimary: z.boolean().optional(),
  isBilling: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateContactSchema = createContactSchema
  .omit({ clientId: true })
  .partial()
  .extend({
    id: entityIdSchema,
  });

export const createAddressSchema = z.object({
  clientId: entityIdSchema,
  kind: addressKindSchema.default("fiscal"),
  street: z.string().trim().min(1, "Calle obligatoria").max(200),
  number: z.string().trim().max(40).optional().nullable(),
  floor: z.string().trim().max(20).optional().nullable(),
  apartment: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().min(1, "Localidad obligatoria").max(100),
  state: z.string().trim().min(1, "Provincia obligatoria").max(100),
  postalCode: z.string().trim().max(20).optional().nullable(),
  country: z.string().trim().max(2).default("AR"),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateAddressSchema = createAddressSchema
  .omit({ clientId: true })
  .partial()
  .extend({
    id: entityIdSchema,
  });

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsInput = z.infer<typeof listClientsSchema>;
export type SoftDeleteClientInput = z.infer<typeof softDeleteClientSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
