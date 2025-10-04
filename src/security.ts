import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { JWT_EXPIRES_IN, JWT_SECRET } from './config.ts';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const createAuthToken = (user: Pick<User, 'id' | 'email' | 'role'>): string => {
  const payload = {
    email: user.email,
    role: user.role,
  };

  const options: SignOptions = {
    subject: String(user.id),
  };

  if (JWT_EXPIRES_IN) {
    type JwtExpiresIn = Exclude<SignOptions['expiresIn'], undefined>;
    options.expiresIn = JWT_EXPIRES_IN as unknown as JwtExpiresIn;
  }

  return jwt.sign(payload, JWT_SECRET as Secret, options);
};

export const decodeAuthToken = (token: string): AuthTokenPayload => {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }

  return decoded as AuthTokenPayload;
};
