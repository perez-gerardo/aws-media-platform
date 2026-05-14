const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function validateUpload({ filename, contentType, sizeBytes }) {
  if (!filename || !contentType || sizeBytes === undefined) {
    return { valid: false, error: 'Faltan parámetros: filename, contentType y sizeBytes son requeridos.' };
  }

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido. Se aceptan: ${ALLOWED_MIME_TYPES.join(', ')}.`,
    };
  }

  const ext = '.' + filename.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Extensión no permitida. Se aceptan: ${ALLOWED_EXTENSIONS.join(', ')}.`,
    };
  }

  if (sizeBytes > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `El archivo supera el límite de ${MAX_SIZE_BYTES / 1024 / 1024} MB.`,
    };
  }

  return { valid: true };
}

module.exports = { validateUpload, ALLOWED_MIME_TYPES, MAX_SIZE_BYTES };
