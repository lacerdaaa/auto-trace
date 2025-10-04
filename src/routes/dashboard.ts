import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.ts';
import { HttpError } from '../httpErrors.ts';
import { prisma } from '../lib/prisma.ts';
import { buildSuggestions } from '../services/suggestions.ts';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/', async (req, res, next) => {
  try {
    if (!req.currentUser) {
      throw new HttpError(401, 'Usuário não autenticado');
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: req.currentUser.id },
      orderBy: { createdAt: 'asc' },
      include: {
        maintenances: {
          orderBy: { serviceDate: 'asc' },
        },
      },
    });

    const dashboard = vehicles.map((vehicle) => {
      const maintenances = vehicle.maintenances;
      const lastMaintenance = maintenances.at(-1);
      const suggestions = buildSuggestions(vehicle, maintenances);

      return {
        vehicleId: vehicle.id,
        totalMaintenances: maintenances.length,
        lastMaintenanceDate: lastMaintenance?.serviceDate.toISOString() ?? null,
        nextMaintenanceKm: suggestions.nextMaintenanceKm,
        overdue: suggestions.overdue,
      };
    });

    return res.json({ dashboard });
  } catch (error) {
    return next(error);
  }
});
