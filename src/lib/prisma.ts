import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const connectPrisma = async (): Promise<void> => {
  await prisma.$connect();
};

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};
