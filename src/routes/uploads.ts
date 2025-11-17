import { Router } from 'express';
import { z } from 'zod';
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

    const upload = await createPresignedUpload(parsed.data.category, {
      originalName: parsed.data.originalName,
      contentType: parsed.data.contentType,
    });

    return res.json({ upload });
  } catch (error) {
    return next(error);
  }
});

export { uploadsRouter };
