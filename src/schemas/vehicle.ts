import { z } from 'zod';

export const vehicleCategorySchema = z.enum(['car', 'motorcycle']);

const currentYear = new Date().getFullYear();

export const createVehicleSchema = z.object({
  plate: z.string().trim(),
  model: z.string().min(2, 'Modelo muito curto'),
  manufacturer: z.string().min(2, 'Fabricante muito curto'),
  year: z.coerce.number().int().gte(1950).lte(currentYear + 1),
  category: vehicleCategorySchema,
  averageMonthlyKm: z.coerce.number().positive(),
  initialOdometer: z.coerce.number().int().nonnegative(),
});

export const vehicleIdParamSchema = z.object({
  vehicleId: z.string().uuid(),
});

export type CreateVehicleSchema = z.infer<typeof createVehicleSchema>;
