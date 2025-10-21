import chalk from 'chalk';
import type { NextFunction, Request, Response } from 'express';

import { logger } from '../lib/logger.ts';

export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  const method = chalk.cyan(req.method.toUpperCase());
  const url = chalk.gray(req.originalUrl);
  logger.info(`${method} ${url}`);
  next();
};
