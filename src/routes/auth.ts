import { User } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { HttpError } from '../httpErrors.js';
import { prisma } from '../lib/prisma.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';
import { createAuthToken, hashPassword, verifyPassword } from '../security.js';

const mapUserToResponse = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role.toLowerCase(),
  createdAt: user.createdAt.toISOString(),
});

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      throw result.error;
    }

    const { email, name, password } = result.data;

    const normalizedEmail = email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new HttpError(409, 'E-mail já registrado');
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash,
      },
    });
    const token = createAuthToken(user);

    return res.status(201).json({
      token,
      user: mapUserToResponse(user),
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      throw result.error;
    }

    const { email, password } = result.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      throw new HttpError(401, 'Credenciais inválidas');
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      throw new HttpError(401, 'Credenciais inválidas');
    }

    const token = createAuthToken(user);

    return res.json({
      token,
      user: mapUserToResponse(user),
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', authenticate, (req, res, next) => {
  try {
    if (!req.currentUser) {
      throw new HttpError(401, 'Usuário não autenticado');
    }

    return res.json({ user: mapUserToResponse(req.currentUser) });
  } catch (error) {
    return next(error);
  }
});
