const { Router } = require('express');
const { getUploadUrl, getImages, deleteImage } = require('../controllers/images.controller');

const router = Router();

router.post('/upload-url', getUploadUrl);
router.get('/', getImages);
router.delete('/', deleteImage);

module.exports = router;
