const s3Service = require('../services/s3.service');
const { validateUpload } = require('../validators/upload.validator');

async function getUploadUrl(req, res, next) {
  try {
    const { filename, contentType, sizeBytes } = req.body;

    const { valid, error } = validateUpload({ filename, contentType, sizeBytes });
    if (!valid) {
      return res.status(400).json({ error, code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });
    }

    const result = await s3Service.generateUploadUrl(filename, contentType);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getImages(req, res, next) {
  try {
    const images = await s3Service.listImages();
    res.status(200).json(images);
  } catch (err) {
    next(err);
  }
}

async function deleteImage(req, res, next) {
  try {
    const rawKey = req.query.key || '';
    const key = decodeURIComponent(rawKey);
    if (!key || !key.startsWith('originales/')) {
      return res.status(400).json({ error: 'Key inválida.', code: 'INVALID_KEY', timestamp: new Date().toISOString() });
    }
    await s3Service.deleteImage(key);
    res.status(200).json({ deleted: true, key, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

module.exports = { getUploadUrl, getImages, deleteImage };
