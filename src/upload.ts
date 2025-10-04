import multer from 'multer';
import path from 'node:path';
import { ensureUploadDirectories, MAINTENANCE_DOC_DIR, VEHICLE_PHOTO_DIR } from './config.ts';

ensureUploadDirectories();

const timestampedName = (original: string): string => {
  const ext = path.extname(original);
  const base = path.basename(original, ext).replace(/\s+/g, '-').toLowerCase();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${base}${ext}`;
};

const createDiskStorage = (destination: string): multer.StorageEngine =>
  multer.diskStorage({
    destination,
    filename: (_req, file, cb) => cb(null, timestampedName(file.originalname)),
  });

export const vehiclePhotoUpload = multer({
  storage: createDiskStorage(VEHICLE_PHOTO_DIR),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'photo'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const maintenanceDocumentUpload = multer({
  storage: createDiskStorage(MAINTENANCE_DOC_DIR),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
