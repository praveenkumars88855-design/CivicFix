import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const storage = multer.diskStorage({
  destination(_request, _file, callback) {
    mkdir(uploadDirectory, { recursive: true })
      .then(() => callback(null, uploadDirectory))
      .catch(callback);
  },
  filename(_request, file, callback) {
    callback(null, `${randomUUID()}${allowedTypes.get(file.mimetype)}`);
  },
});

export const uploadIssuePhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error('Upload a JPG, PNG, or WebP image no larger than 5 MB');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

export function cleanUploadedFile(error, request, _response, next) {
  if (!request.file) return next(error);
  unlink(request.file.path)
    .catch((cleanupError) => {
      if (cleanupError.code !== 'ENOENT') console.error('Unable to remove invalid issue photo:', cleanupError);
    })
    .finally(() => next(error));
}
