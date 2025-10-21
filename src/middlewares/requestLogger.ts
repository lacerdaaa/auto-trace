import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';

import { logger } from '../lib/logger.ts';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = randomUUID();
  req.requestId = requestId;
  const startTime = performance.now();

  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });

  const finalize = (status: number) => {
    const duration = Math.round(performance.now() - startTime);
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      durationMs: duration,
    });
  };

  let finished = false;
  const onFinish = () => {
    if (!finished) {
      finished = true;
      finalize(res.statusCode);
    }
  };

  res.on('finish', onFinish);
  res.on('close', onFinish);
  res.on('error', onFinish);

  next();
};
