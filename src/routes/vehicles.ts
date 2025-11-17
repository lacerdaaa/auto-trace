import type { MaintenanceRecord, Vehicle } from '@prisma/client';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.ts';
import { HttpError } from '../httpErrors.ts';
import { prisma } from '../lib/prisma.ts';
import {
  doesUploadedFileExist,
  finalizeUploadedFile,
  getMaintenanceDocumentUrl,
  getVehiclePhotoUrl,
  type UploadCategory,
} from '../lib/storage.ts';
import { createMaintenanceSchema, maintenanceQuerySchema } from '../schemas/maintenance.ts';
import { createVehicleSchema, vehicleIdParamSchema } from '../schemas/vehicle.ts';
import { buildSuggestions } from '../services/suggestions.ts';
import { vehicleCategoryFromPrisma, vehicleCategoryToPrisma } from '../types.ts';

export const vehiclesRouter = Router();

vehiclesRouter.use(authenticate);

const mapVehicle = (vehicle: Vehicle) => ({
  id: vehicle.id,
  userId: vehicle.userId,
  plate: vehicle.plate,
  model: vehicle.model,
  manufacturer: vehicle.manufacturer,
  year: vehicle.year,
  category: vehicleCategoryFromPrisma(vehicle.category),
  averageMonthlyKm: vehicle.averageMonthlyKm,
  initialOdometer: vehicle.initialOdometer,
  photoFileName: vehicle.photoFileName ?? null,
  photoUrl: getVehiclePhotoUrl(vehicle.photoFileName),
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
  documentUrl: getMaintenanceDocumentUrl(maintenance.documentFileName),
  createdAt: maintenance.createdAt.toISOString(),
  updatedAt: maintenance.updatedAt.toISOString(),
});

const ensureCurrentUser = (req: Request) => {
  if (!req.currentUser) {
    throw new HttpError(401, 'Usuário não autenticado');
  }
  return req.currentUser;
};

const fileReferenceSchema = z.object({
  fileName: z.string().min(1),
});

const ensureUploadedFileForCategory = async (category: UploadCategory, fileName: string): Promise<void> => {
  const exists = await doesUploadedFileExist(category, fileName);
  if (!exists) {
    throw new HttpError(400, 'Arquivo de upload não encontrado ou expirado');
  }
  await finalizeUploadedFile(category, fileName);
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
        initialOdometer: parsed.data.initialOdometer,
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

vehiclesRouter.post('/:vehicleId/photo', async (req, res, next) => {
  try {
    const user = ensureCurrentUser(req);
    const params = vehicleIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw params.error;
    }

    const parsedBody = fileReferenceSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw parsedBody.error;
    }

    await getVehicleForUser(params.data.vehicleId, user.id);

    await ensureUploadedFileForCategory('vehicle-photo', parsedBody.data.fileName);

    const updated = await prisma.vehicle.update({
      where: { id: params.data.vehicleId },
      data: { photoFileName: parsedBody.data.fileName },
    });

    return res.json({ vehicle: mapVehicle(updated) });
  } catch (error) {
    return next(error);
  }
});

vehiclesRouter.post('/:vehicleId/maintenance', async (req, res, next) => {
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

    let documentFileName: string | null = null;
    if (parsedBody.data.documentFileName) {
      await ensureUploadedFileForCategory('maintenance-document', parsedBody.data.documentFileName);
      documentFileName = parsedBody.data.documentFileName;
    }

    const maintenance = await prisma.maintenanceRecord.create({
      data: {
        vehicleId: params.data.vehicleId,
        userId: user.id,
        serviceType: parsedBody.data.serviceType,
        serviceDate: parsedBody.data.serviceDate,
        odometer: parsedBody.data.odometer,
        workshop: parsedBody.data.workshop,
        notes: parsedBody.data.notes ?? null,
        documentFileName,
      },
    });

    return res.status(201).json({ maintenance: mapMaintenance(maintenance) });
  } catch (error) {
    return next(error);
  }
});

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
