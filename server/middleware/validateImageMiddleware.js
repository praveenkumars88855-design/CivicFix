import { open } from 'node:fs/promises';

const signatures = {
  'image/jpeg': (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (bytes) => bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
};

export function validateImageFile(request, _response, next) {
  if (!request.file) return next();

  async function matchesImageSignature() {
    const file = await open(request.file.path, 'r');
    try {
      const header = Buffer.alloc(12);
      const { bytesRead } = await file.read(header, 0, header.length, 0);
      return bytesRead >= 12 && Boolean(signatures[request.file.mimetype]?.(header));
    } finally {
      await file.close();
    }
  }

  matchesImageSignature().then((isValidImage) => {
    if (!isValidImage) {
      const error = new Error('The uploaded file is not a valid JPG, PNG, or WebP image');
      error.status = 400;
      return next(error);
    }
    return next();
  }).catch(next);
}
