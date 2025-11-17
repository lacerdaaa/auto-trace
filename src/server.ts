import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { APP_PORT } from './config.ts';
import { logger } from './lib/logger.ts';
import { connectPrisma, disconnectPrisma } from './lib/prisma.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { requestLogger } from './middlewares/requestLogger.ts';
import { authRouter } from './routes/auth.ts';
import { certificatesRouter } from './routes/certificates.ts';
import { dashboardRouter } from './routes/dashboard.ts';
import { vehiclesRouter } from './routes/vehicles.ts';
import { uploadsRouter } from './routes/uploads.ts';

const app = express();

app.use(requestLogger);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/uploads', uploadsRouter);

app.use('/auth', authRouter);
app.use('/vehicles', vehiclesRouter);
app.use('/dashboard', dashboardRouter);
app.use('/certificates', certificatesRouter);

app.use(errorHandler);

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? '')}`) {
  const start = async () => {
    try {
      await connectPrisma();
      const server = app.listen(APP_PORT, () => {
        logger.info('AutoTrace API iniciada', { port: APP_PORT });
      });

      const shutdown = async () => {
        logger.info('Encerrando servidor AutoTrace...');
        await disconnectPrisma();
        server.close(() => process.exit(0));
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (error) {
      logger.error('Falha ao iniciar o servidor', { error });
      process.exit(1);
    }
  };

  void start();
}

export default app;
