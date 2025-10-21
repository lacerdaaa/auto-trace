import type { NextFunction, Request, Response } from 'express';

import { logger } from '../lib/logger.ts';

export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
};
