import { Router, type ErrorRequestHandler } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';

const router = Router();

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const uploadDirectory = path.join(os.tmpdir(), 'creativehub-ai-matcher');

const upload = multer({
  dest: uploadDirectory,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 6,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(new Error('Only JPG, PNG, WebP, and GIF images are supported.'));
      return;
    }

    callback(null, true);
  },
});

router.post('/search', upload.array('images', 6), (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];

  if (files.length === 0) {
    return res.status(400).json({ message: 'Upload at least one image.' });
  }

  return res.json({
    message: 'AI image matching mock response.',
    uploadedImageCount: files.length,
    files: files.map((file) => ({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      temporaryPath: file.path,
    })),
    matches: [
      {
        freelancerId: 'mock-freelancer-1',
        matchScore: 0.94,
        reason: 'Mock match. AI similarity scoring is not implemented yet.',
        matchedImageUrls: [],
      },
      {
        freelancerId: 'mock-freelancer-2',
        matchScore: 0.88,
        reason: 'Mock match. Portfolio comparison will be connected later.',
        matchedImageUrls: [],
      },
    ],
  });
});

const handleUploadError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: error.message });
  }

  return res.status(400).json({ message: error.message || 'Unable to process uploaded images.' });
};

router.use(handleUploadError);

export default router;
