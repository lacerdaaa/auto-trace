import type { MaintenanceRecord, Vehicle } from '@prisma/client';
import { AVERAGE_MONTHLY_KM, PREVENTIVE_PROFILES } from '../config.ts';
import type { PreventiveProfileKey } from '../config.ts';
import { vehicleCategoryFromPrisma } from '../types.ts';
import type { SuggestionSummary } from '../types.ts';

const MONTH_IN_MS = 1000 * 60 * 60 * 24 * 30;

const estimateCurrentKm = (vehicle: Vehicle, latestMaintenance?: MaintenanceRecord): number => {
  if (!latestMaintenance) {
    const millisSinceCreation = Date.now() - vehicle.createdAt.getTime();
    const monthsSinceCreation = millisSinceCreation / MONTH_IN_MS;
    return vehicle.initialOdometer + monthsSinceCreation * (vehicle.averageMonthlyKm ?? AVERAGE_MONTHLY_KM);
  }

  const millisSinceLast = Date.now() - latestMaintenance.serviceDate.getTime();
  const monthsSinceLast = millisSinceLast / MONTH_IN_MS;
  return latestMaintenance.odometer + monthsSinceLast * vehicle.averageMonthlyKm;
};

const getProfileKey = (vehicle: Vehicle): PreventiveProfileKey => {
  const category = vehicleCategoryFromPrisma(vehicle.category);
  return category in PREVENTIVE_PROFILES ? category : 'other';
};

const estimateDueDate = (
  lastMaintenance: MaintenanceRecord | undefined,
  vehicle: Vehicle,
  targetKm: number,
): string | undefined => {
  if (!lastMaintenance) {
    const kmDiff = targetKm - vehicle.initialOdometer;
    if (kmDiff <= 0) {
      return vehicle.createdAt.toISOString();
    }
    const monthsToTarget = kmDiff / vehicle.averageMonthlyKm;
    const dueDate = new Date(vehicle.createdAt.getTime() + monthsToTarget * MONTH_IN_MS);
    return dueDate.toISOString();
  }

  const kmDiff = targetKm - lastMaintenance.odometer;
  if (kmDiff <= 0) {
    return lastMaintenance.serviceDate.toISOString();
  }

  const monthsNeeded = kmDiff / vehicle.averageMonthlyKm;
  const dueDate = new Date(lastMaintenance.serviceDate.getTime() + monthsNeeded * MONTH_IN_MS);
  return dueDate.toISOString();
};

export const buildSuggestions = (
  vehicle: Vehicle,
  maintenances: MaintenanceRecord[],
): SuggestionSummary => {
  const latestMaintenance = maintenances.at(-1);
  const profileKey = getProfileKey(vehicle);
  const schedule = PREVENTIVE_PROFILES[profileKey];
  const estimatedKm = estimateCurrentKm(vehicle, latestMaintenance);

  const baseOdometer = latestMaintenance?.odometer ?? vehicle.initialOdometer;
  const nextStop = schedule.find((item) => item.kmMark > baseOdometer) ?? schedule.at(-1)!;

  const kmToNext = Math.max(0, nextStop.kmMark - estimatedKm);
  const overdue = kmToNext <= 0;
  const estimatedDueDate = estimateDueDate(latestMaintenance, vehicle, nextStop.kmMark);

  const upcoming = schedule.map((item) => ({
    kmMark: item.kmMark,
    checklist: [...item.items],
    overdue: estimatedKm >= item.kmMark,
  }));

  return {
    estimatedCurrentKm: Math.round(estimatedKm),
    monthlyAverageKm: vehicle.averageMonthlyKm,
    nextMaintenanceKm: nextStop.kmMark,
    kmToNext: Math.round(kmToNext),
    overdue,
    checklist: [...nextStop.items],
    upcoming,
    ...(estimatedDueDate ? { estimatedDueDate } : {}),
  };
};
