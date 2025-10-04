import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { APP_PORT, UPLOAD_ROOT } from './config.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { certificatesRouter } from './routes/certificates.js';
import { dashboardRouter } from './routes/dashboard.js';
import { vehiclesRouter } from './routes/vehicles.js';
import { connectPrisma, disconnectPrisma } from './lib/prisma.js';

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
