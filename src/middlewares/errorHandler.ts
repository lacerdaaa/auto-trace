import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../httpErrors.ts';
import { ZodError } from 'zod';
import multer from 'multer';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validação falhou',
      details: error.flatten(),
    });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'Erro no upload',
      code: error.code,
      field: error.field,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: error.message,
      details: error.details ?? null,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(', ') : error.meta?.target;
    const payload = {
      error: 'Operação inválida no banco de dados',
      code: error.code,
      target: target ?? null,
    };

    if (error.code === 'P2002') {
      return res.status(409).json({ ...payload, error: 'Registro duplicado', target: target ?? null });
    }

    return res.status(400).json(payload);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: 'Dados inválidos para o banco de dados',
      details: error.message,
    });
  }

  console.error(error);

  return res.status(500).json({
    error: 'Erro interno inesperado',
  });
};
