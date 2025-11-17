import { Storage } from '@google-cloud/storage';
import path from 'node:path';

export type UploadCategory = 'vehicle-photo' | 'maintenance-document';

type CategoryConfig = {
  prefix: string;
  requiresImage: boolean;
};

export type PresignedUpload = {
  fileName: string;
  uploadUrl: string;
  uploadMethod: 'PUT';
  uploadHeaders: Record<string, string>;
  publicUrl: string;
  expiresAt: string;
};

const CATEGORY_CONFIG: Record<UploadCategory, CategoryConfig> = {
  'vehicle-photo': {
    prefix: 'vehicle-photos',
    requiresImage: true,
  },
  'maintenance-document': {
    prefix: 'maintenance-docs',
    requiresImage: false,
  },
};

const removeTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const STORAGE_PUBLIC_BASE_URL = process.env.STORAGE_PUBLIC_BASE_URL
  ? removeTrailingSlash(process.env.STORAGE_PUBLIC_BASE_URL)
  : null;
const GCS_BUCKET = process.env.GCS_BUCKET ?? null;
const PRESIGNED_UPLOAD_TTL_MS = Number.parseInt(process.env.PRESIGNED_UPLOAD_TTL_MS ?? `${15 * 60 * 1000}`, 10);
const SHOULD_MAKE_GCS_PUBLIC = process.env.GCS_MAKE_PUBLIC !== 'false';

if (!GCS_BUCKET) {
  throw new Error('GCS_BUCKET é obrigatório para armazenamento de arquivos');
}

const storage = new Storage();
const gcsBucket = storage.bucket(GCS_BUCKET);

const timestampedName = (original: string): string => {
  const ext = path.extname(original);
  const base = path.basename(original, ext).replace(/\s+/g, '-').toLowerCase();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${base}${ext}`;
};

const baseUrlForCategory = (category: UploadCategory): string => {
  const prefix = CATEGORY_CONFIG[category].prefix;

  if (STORAGE_PUBLIC_BASE_URL) {
    return `${STORAGE_PUBLIC_BASE_URL}/${prefix}`;
  }

  if (!GCS_BUCKET) {
    throw new Error('GCS_BUCKET não definido para geração de URLs públicas');
  }

  return `https://storage.googleapis.com/${GCS_BUCKET}/${prefix}`;
};

const buildFileUrl = (category: UploadCategory, fileName?: string | null): string | null => {
  if (!fileName) {
    return null;
  }
  return `${baseUrlForCategory(category)}/${fileName}`;
};

const ensureContentType = (category: UploadCategory, contentType: string): void => {
  if (!contentType) {
    throw new Error('contentType obrigatório para geração de upload');
  }

  if (CATEGORY_CONFIG[category].requiresImage && !contentType.startsWith('image/')) {
    throw new Error('O tipo de conteúdo informado não é permitido para fotos de veículo');
  }
};

const getObjectKey = (category: UploadCategory, fileName: string): string =>
  `${CATEGORY_CONFIG[category].prefix}/${fileName}`;

const doesGcsFileExist = async (category: UploadCategory, fileName: string): Promise<boolean> => {
  const [exists] = await gcsBucket.file(getObjectKey(category, fileName)).exists();
  return exists;
};

export const doesUploadedFileExist = async (category: UploadCategory, fileName: string): Promise<boolean> => {
  return doesGcsFileExist(category, fileName);
};

export const createPresignedUpload = async (
  category: UploadCategory,
  params: { originalName: string; contentType: string },
): Promise<PresignedUpload> => {
  ensureContentType(category, params.contentType);

  const fileName = timestampedName(params.originalName);
  const expiresAtMs = Date.now() + PRESIGNED_UPLOAD_TTL_MS;
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const publicUrl = `${baseUrlForCategory(category)}/${fileName}`;
  const uploadHeaders = { 'Content-Type': params.contentType };

  const remoteFile = gcsBucket.file(getObjectKey(category, fileName));
  const [signedUrl] = await remoteFile.getSignedUrl({
    action: 'write',
    expires: expiresAtMs,
    contentType: params.contentType,
  });

  return {
    fileName,
    uploadUrl: signedUrl,
    uploadMethod: 'PUT',
    uploadHeaders,
    publicUrl,
    expiresAt: expiresAtIso,
  };
};

export const getVehiclePhotoUrl = (fileName?: string | null) => buildFileUrl('vehicle-photo', fileName);
export const getMaintenanceDocumentUrl = (fileName?: string | null) =>
  buildFileUrl('maintenance-document', fileName);

const publishGcsFileIfNeeded = async (category: UploadCategory, fileName: string): Promise<void> => {
  if (!SHOULD_MAKE_GCS_PUBLIC) {
    return;
  }
  const file = gcsBucket.file(getObjectKey(category, fileName));
  await file.makePublic();
};

export const finalizeUploadedFile = async (category: UploadCategory, fileName: string): Promise<void> => {
  await publishGcsFileIfNeeded(category, fileName);
};

const readGcsFileBuffer = async (category: UploadCategory, fileName: string): Promise<Buffer | null> => {
  try {
    const file = gcsBucket.file(getObjectKey(category, fileName));
    const [buffer] = await file.download();
    return buffer;
  } catch {
    return null;
  }
};

export const getUploadedFileBuffer = async (
  category: UploadCategory,
  fileName: string,
): Promise<Buffer | null> => {
  if (!fileName) {
    return null;
  }
  return readGcsFileBuffer(category, fileName);
};

export const getVehiclePhotoBuffer = (fileName: string) => getUploadedFileBuffer('vehicle-photo', fileName);
