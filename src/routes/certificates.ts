import type { Certificate, MaintenanceRecord, Vehicle } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.ts';
import { HttpError } from '../httpErrors.ts';
import { prisma } from '../lib/prisma.ts';
import { vehicleIdParamSchema } from '../schemas/vehicle.ts';
import { generateCertificate } from '../services/certificates.ts';
import { buildSuggestions } from '../services/suggestions.ts';
import { vehicleCategoryFromPrisma } from '../types.ts';
import { z } from 'zod';
import { getVehiclePhotoBuffer } from '../lib/storage.ts';

export const certificatesRouter = Router();

const certificateIdSchema = z.object({
  certificateId: z.string().uuid(),
});

const mapCertificate = (certificate: Certificate) => ({
  id: certificate.id,
  vehicleId: certificate.vehicleId,
  vehiclePlate: certificate.vehiclePlate,
  generatedAt: certificate.generatedAt.toISOString(),
  maintenanceCount: certificate.maintenanceCount,
  lastMaintenanceDate: certificate.lastMaintenanceDate?.toISOString() ?? null,
  overdue: certificate.overdue,
});

const getVehicleForUser = async (vehicleId: string, userId: string) => {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, userId } });
  if (!vehicle) {
    throw new HttpError(404, 'Veículo não encontrado');
  }
  return vehicle;
};

certificatesRouter.get('/validate/:certificateId', async (req, res, next) => {
  try {
    const params = certificateIdSchema.safeParse(req.params);
    if (!params.success) {
      throw params.error;
    }

    const certificate = await prisma.certificate.findUnique({ where: { id: params.data.certificateId } });
    if (!certificate) {
      throw new HttpError(404, 'Certificado não encontrado');
    }

    return res.json({ certificate: mapCertificate(certificate) });
  } catch (error) {
    return next(error);
  }
});

certificatesRouter.use(authenticate);

const mapVehicleForCertificate = (vehicle: Vehicle) => ({
  id: vehicle.id,
  plate: vehicle.plate,
  model: vehicle.model,
  manufacturer: vehicle.manufacturer,
  year: vehicle.year,
  category: vehicleCategoryFromPrisma(vehicle.category),
  averageMonthlyKm: vehicle.averageMonthlyKm,
});

const mapMaintenancesForCertificate = (maintenances: MaintenanceRecord[]) =>
  maintenances.map((maintenance) => ({
    id: maintenance.id,
    serviceType: maintenance.serviceType,
    serviceDate: maintenance.serviceDate,
    odometer: maintenance.odometer,
    workshop: maintenance.workshop,
  }));

certificatesRouter.get('/:vehicleId', async (req, res, next) => {
  try {
    if (!req.currentUser) {
      throw new HttpError(401, 'Usuário não autenticado');
    }

    const params = vehicleIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw params.error;
    }

    const vehicle = await getVehicleForUser(params.data.vehicleId, req.currentUser.id);
    const maintenances = await prisma.maintenanceRecord.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { serviceDate: 'asc' },
    });

    const suggestions = buildSuggestions(vehicle, maintenances);

    const vehiclePhotoBuffer = vehicle.photoFileName
      ? await getVehiclePhotoBuffer(vehicle.photoFileName)
      : null;

    const result = await generateCertificate({
      vehicle: mapVehicleForCertificate(vehicle),
      ownerName: req.currentUser.name,
      maintenances: mapMaintenancesForCertificate(maintenances),
      suggestions,
      vehiclePhoto: vehiclePhotoBuffer,
    });

    await prisma.certificate.create({
      data: {
        id: result.certificateId,
        vehicleId: vehicle.id,
        userId: req.currentUser.id,
        vehiclePlate: vehicle.plate,
        maintenanceCount: maintenances.length,
        lastMaintenanceDate: maintenances.at(-1)?.serviceDate ?? null,
        overdue: suggestions.overdue,
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="autotrace-certificate-${vehicle.plate}.pdf"`);
    res.setHeader('X-Certificate-Id', result.certificateId);

    return res.send(result.buffer);
  } catch (error) {
    return next(error);
  }
});
