import { type NextFunction, type Request, type Response } from 'express';
import { HttpError } from '../httpErrors.js';
import { prisma } from '../lib/prisma.js';
import { decodeAuthToken } from '../security.js';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;

  if (!header) {
    return next(new HttpError(401, 'Token não fornecido'));
  }

  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return next(new HttpError(401, 'Formato de autorização inválido. Use Bearer token.'));
  }

  try {
    const payload = decodeAuthToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      return next(new HttpError(401, 'Usuário não encontrado'));
    }

    req.currentUser = user;
    return next();
  } catch (error) {
    return next(new HttpError(401, 'Token inválido ou expirado', error));
  }
};
