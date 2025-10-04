import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { APP_PORT, UPLOAD_ROOT } from './config.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { authRouter } from './routes/auth.ts';
import { certificatesRouter } from './routes/certificates.ts';
import { dashboardRouter } from './routes/dashboard.ts';
import { vehiclesRouter } from './routes/vehicles.ts';
import { connectPrisma, disconnectPrisma } from './lib/prisma.ts';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/uploads', express.static(UPLOAD_ROOT));
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
        console.log(`AutoTrace API rodando na porta ${APP_PORT}`);
      });

      const shutdown = async () => {
        console.log('Encerrando servidor AutoTrace...');
        await disconnectPrisma();
        server.close(() => process.exit(0));
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (error) {
      console.error('Falha ao iniciar o servidor', error);
      process.exit(1);
    }
  };

  void start();
}

export default app;
