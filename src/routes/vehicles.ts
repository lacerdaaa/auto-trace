import { MaintenanceRecord, Vehicle } from '@prisma/client';
import { Router, type Request } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { HttpError } from '../httpErrors.js';
import { prisma } from '../lib/prisma.js';
import { createMaintenanceSchema, maintenanceQuerySchema } from '../schemas/maintenance.js';
import { createVehicleSchema, vehicleIdParamSchema } from '../schemas/vehicle.js';
import { buildSuggestions } from '../services/suggestions.js';
import { maintenanceDocumentUpload, vehiclePhotoUpload } from '../upload.js';
import { vehicleCategoryFromPrisma, vehicleCategoryToPrisma } from '../types.js';

export const vehiclesRouter = Router();

vehiclesRouter.use(authenticate);

const buildPhotoUrl = (fileName?: string | null) => (fileName ? `/uploads/vehicle-photos/${fileName}` : null);
const buildDocumentUrl = (fileName?: string | null) => (fileName ? `/uploads/maintenance-docs/${fileName}` : null);

const mapVehicle = (vehicle: Vehicle) => ({
  id: vehicle.id,
  userId: vehicle.userId,
  plate: vehicle.plate,
  model: vehicle.model,
  manufacturer: vehicle.manufacturer,
  year: vehicle.year,
  category: vehicleCategoryFromPrisma(vehicle.category),
  averageMonthlyKm: vehicle.averageMonthlyKm,
  photoFileName: vehicle.photoFileName ?? null,
  photoUrl: buildPhotoUrl(vehicle.photoFileName),
  createdAt: vehicle.createdAt.toISOString(),
  updatedAt: vehicle.updatedAt.toISOString(),
});

const mapMaintenance = (maintenance: MaintenanceRecord) => ({
  id: maintenance.id,
  vehicleId: maintenance.vehicleId,
  userId: maintenance.userId,
  serviceType: maintenance.serviceType,
  serviceDate: maintenance.serviceDate.toISOString(),
  odometer: maintenance.odometer,
  workshop: maintenance.workshop,
  notes: maintenance.notes ?? null,
  documentFileName: maintenance.documentFileName ?? null,
  documentUrl: buildDocumentUrl(maintenance.documentFileName),
  createdAt: maintenance.createdAt.toISOString(),
  updatedAt: maintenance.updatedAt.toISOString(),
});

const ensureCurrentUser = (req: Request) => {
  if (!req.currentUser) {
    throw new HttpError(401, 'Usuário não autenticado');
  }
  return req.currentUser;
};

vehiclesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createVehicleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }

    const user = ensureCurrentUser(req);

    const normalizedPlate = parsed.data.plate.replace(/\s+/g, '').toUpperCase();
    const existing = await prisma.vehicle.findUnique({ where: { plate: normalizedPlate } });
    if (existing) {
      throw new HttpError(409, 'Veículo já cadastrado');
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        userId: user.id,
        plate: normalizedPlate,
        model: parsed.data.model,
        manufacturer: parsed.data.manufacturer,
        year: parsed.data.year,
        category: vehicleCategoryToPrisma(parsed.data.category),
        averageMonthlyKm: parsed.data.averageMonthlyKm,
      },
    });

    return res.status(201).json({ vehicle: mapVehicle(vehicle) });
  } catch (error) {
    return next(error);
  }
});

const getVehicleForUser = async (vehicleId: string, userId: string) => {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, userId } });
  if (!vehicle) {
    throw new HttpError(404, 'Veículo não encontrado');
  }

  return vehicle;
};

vehiclesRouter.get('/', async (req, res, next) => {
  try {
    const user = ensureCurrentUser(req);

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ vehicles: vehicles.map(mapVehicle) });
  } catch (error) {
    return next(error);
  }
});

vehiclesRouter.get('/:vehicleId', async (req, res, next) => {
  try {
    const user = ensureCurrentUser(req);
    const params = vehicleIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw params.error;
    }

    const vehicle = await getVehicleForUser(params.data.vehicleId, user.id);
    const maintenances = await prisma.maintenanceRecord.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { serviceDate: 'asc' },
    });
    const suggestions = buildSuggestions(vehicle, maintenances);

    return res.json({
      vehicle: mapVehicle(vehicle),
      maintenances: maintenances.map(mapMaintenance),
      suggestions,
    });
  } catch (error) {
    return next(error);
  }
});

vehiclesRouter.post('/:vehicleId/photo', vehiclePhotoUpload.single('photo'), async (req, res, next) => {
  try {
    const user = ensureCurrentUser(req);
    const params = vehicleIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw params.error;
    }

    if (!req.file) {
      throw new HttpError(400, 'Nenhuma foto enviada');
    }

    await getVehicleForUser(params.data.vehicleId, user.id);

    const updated = await prisma.vehicle.update({
      where: { id: params.data.vehicleId },
      data: { photoFileName: req.file.filename },
    });

    return res.json({ vehicle: mapVehicle(updated) });
  } catch (error) {
    return next(error);
  }
});

vehiclesRouter.post(
  '/:vehicleId/maintenance',
  maintenanceDocumentUpload.single('document'),
  async (req, res, next) => {
    try {
      const user = ensureCurrentUser(req);
      const params = vehicleIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw params.error;
      }

      const parsedBody = createMaintenanceSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw parsedBody.error;
      }

      await getVehicleForUser(params.data.vehicleId, user.id);

      const maintenance = await prisma.maintenanceRecord.create({
        data: {
          vehicleId: params.data.vehicleId,
          userId: user.id,
          serviceType: parsedBody.data.serviceType,
          serviceDate: parsedBody.data.serviceDate,
          odometer: parsedBody.data.odometer,
          workshop: parsedBody.data.workshop,
          notes: parsedBody.data.notes ?? null,
          documentFileName: req.file?.filename ?? null,
        },
      });

      return res.status(201).json({ maintenance: mapMaintenance(maintenance) });
    } catch (error) {
      return next(error);
    }
  },
);

vehiclesRouter.get('/:vehicleId/maintenance', async (req, res, next) => {
  try {
    const user = ensureCurrentUser(req);
    const params = vehicleIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw params.error;
    }

    const query = maintenanceQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw query.error;
    }

    await getVehicleForUser(params.data.vehicleId, user.id);

    const from = query.data.from ? new Date(query.data.from) : undefined;
    const to = query.data.to ? new Date(query.data.to) : undefined;

    if (from && Number.isNaN(from.getTime())) {
      throw new HttpError(400, 'Parâmetro "from" inválido');
    }

    if (to && Number.isNaN(to.getTime())) {
      throw new HttpError(400, 'Parâmetro "to" inválido');
    }

    const maintenances = await prisma.maintenanceRecord.findMany({
      where: {
        vehicleId: params.data.vehicleId,
        ...(from || to
          ? {
              serviceDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { serviceDate: 'asc' },
    });

    return res.json({ maintenances: maintenances.map(mapMaintenance) });
  } catch (error) {
    return next(error);
  }
});

vehiclesRouter.get('/:vehicleId/suggestions', async (req, res, next) => {
  try {
    const user = ensureCurrentUser(req);
    const params = vehicleIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw params.error;
    }

    const vehicle = await getVehicleForUser(params.data.vehicleId, user.id);
    const maintenances = await prisma.maintenanceRecord.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { serviceDate: 'asc' },
    });
    const suggestions = buildSuggestions(vehicle, maintenances);

    return res.json({ suggestions });
  } catch (error) {
    return next(error);
  }
});

export default vehiclesRouter;
