import { VehicleCategory as PrismaVehicleCategory } from '@prisma/client';

export type UserRoleValue = 'user' | 'admin';
export type VehicleCategoryValue = 'car' | 'motorcycle' | 'truck' | 'other';

export interface CertificatePayload {
  certificateId: string;
  vehicleId: string;
  vehiclePlate: string;
  generatedAt: Date;
}

export interface PreventiveChecklistItem {
  kmMark: number;
  items: string[];
}

export interface PreventiveMaintenanceProfile {
  category: VehicleCategoryValue;
  schedule: PreventiveChecklistItem[];
}

export interface SuggestionSummary {
  estimatedCurrentKm: number;
  monthlyAverageKm: number;
  nextMaintenanceKm: number;
  kmToNext: number;
  overdue: boolean;
  estimatedDueDate?: string;
  checklist: string[];
  upcoming: Array<{
    kmMark: number;
    checklist: string[];
    overdue: boolean;
  }>;
}

export const vehicleCategoryToPrisma = (value: VehicleCategoryValue): PrismaVehicleCategory => {
  switch (value) {
    case 'car':
      return 'CAR';
    case 'motorcycle':
      return 'MOTORCYCLE';
    case 'truck':
      return 'TRUCK';
    default:
      return 'OTHER';
  }
};

export const vehicleCategoryFromPrisma = (value: PrismaVehicleCategory): VehicleCategoryValue => {
  switch (value) {
    case 'CAR':
      return 'car';
    case 'MOTORCYCLE':
      return 'motorcycle';
    case 'TRUCK':
      return 'truck';
    default:
      return 'other';
  }
};
