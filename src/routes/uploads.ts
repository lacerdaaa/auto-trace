import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger.ts';
import { createPresignedUpload } from '../lib/storage.ts';
import { authenticate } from '../middlewares/authenticate.ts';

const uploadsRouter = Router();

const uploadCategorySchema = z.enum(['vehicle-photo', 'maintenance-document']);

const presignSchema = z.object({
  category: uploadCategorySchema,
  originalName: z.string().min(1),
  contentType: z.string().min(1),
});

uploadsRouter.post('/presign', authenticate, async (req, res, next) => {
  try {
    const parsed = presignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }

    logger.info('Gerando URL pré-assinada para upload', {
      category: parsed.data.category,
      contentType: parsed.data.contentType,
      originalName: parsed.data.originalName,
      userId: req.currentUser?.id ?? null,
    });

    const upload = await createPresignedUpload(parsed.data.category, {
      originalName: parsed.data.originalName,
      contentType: parsed.data.contentType,
    });

    logger.info('URL pré-assinada gerada com sucesso', {
      category: parsed.data.category,
      fileName: upload.fileName,
      expiresAt: upload.expiresAt,
      userId: req.currentUser?.id ?? null,
    });

    return res.json({ upload });
  } catch (error) {
    logger.error('Falha ao gerar URL pré-assinada', {
      error,
      userId: req.currentUser?.id ?? null,
      bodyKeys: Object.keys(req.body ?? {}),
    });
    return next(error);
  }
});

export { uploadsRouter };
