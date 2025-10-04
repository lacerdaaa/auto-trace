import { z } from 'zod';

export const createMaintenanceSchema = z.object({
  serviceType: z.string().min(2, 'Informe o tipo do serviço'),
  serviceDate: z.coerce.date(),
  odometer: z.coerce.number().int().nonnegative(),
  workshop: z.string().min(2, 'Informe a oficina'),
  notes: z.string().max(1000).optional(),
});

export const maintenanceQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateMaintenanceSchema = z.infer<typeof createMaintenanceSchema>;
