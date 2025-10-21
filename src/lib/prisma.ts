import { PrismaClient } from '@prisma/client';
import { logger } from './logger.ts';

export const prisma = new PrismaClient();

export const connectPrisma = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Conexão com o banco inicializada');
  } catch (error) {
    logger.error('Falha ao conectar com o banco de dados', { error });
    throw error;
  }
};

export const disconnectPrisma = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Conexão com o banco encerrada');
  } catch (error) {
    logger.error('Falha ao encerrar conexão com o banco de dados', { error });
    throw error;
  }
};
