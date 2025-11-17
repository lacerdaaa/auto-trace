import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../httpErrors.ts';
import { logger } from '../lib/logger.ts';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const context = {
    method: req.method,
    path: req.originalUrl,
  };

  if (error instanceof ZodError) {
    logger.warn('Validation error', { ...context, issues: error.issues });
    return res.status(400).json({
      error: 'Validação falhou',
      details: error.flatten(),
    });
  }

  if (error instanceof HttpError) {
    const payload = {
      error: error.message,
      details: error.details ?? null,
    };
    const severity = error.status >= 500 ? 'error' : 'warn';
    logger[severity]('Handled HttpError', { ...context, status: error.status, details: error.details });
    return res.status(error.status).json(payload);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(', ') : error.meta?.target;
    const payload = {
      error: 'Operação inválida no banco de dados',
      code: error.code,
      target: target ?? null,
    };

    if (error.code === 'P2002') {
      logger.warn('Database unique constraint violation', { ...context, code: error.code, target });
      return res.status(409).json({ ...payload, error: 'Registro duplicado', target: target ?? null });
    }

    logger.warn('Database known request error', { ...context, code: error.code, target });
    return res.status(400).json(payload);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.warn('Database validation error', { ...context, message: error.message });
    return res.status(400).json({
      error: 'Dados inválidos para o banco de dados',
      details: error.message,
    });
  }

  logger.error('Unhandled error', { ...context, error });

  return res.status(500).json({
    error: 'Erro interno inesperado',
  });
};
