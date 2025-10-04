import { z } from 'zod';

export const vehicleCategorySchema = z.enum(['car', 'motorcycle', 'truck', 'other']);

const currentYear = new Date().getFullYear();

export const createVehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{3}-?[0-9][0-9a-zA-Z]{2}$/i, 'Placa inválida'),
  model: z.string().min(2, 'Modelo muito curto'),
  manufacturer: z.string().min(2, 'Fabricante muito curto'),
  year: z.coerce.number().int().gte(1950).lte(currentYear + 1),
  category: vehicleCategorySchema,
  averageMonthlyKm: z.coerce.number().positive(),
});

export const vehicleIdParamSchema = z.object({
  vehicleId: z.string().uuid(),
});

export type CreateVehicleSchema = z.infer<typeof createVehicleSchema>;
