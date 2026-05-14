function errorMiddleware(err, req, res, next) { // eslint-disable-line no-unused-vars
  const timestamp = new Date().toISOString();

  console.error(`[${timestamp}] ERROR ${req.method} ${req.originalUrl}:`, err.message);

  if (err.name === 'NoSuchKey') {
    return res.status(404).json({ error: 'Recurso no encontrado en S3.', code: 'NOT_FOUND', timestamp });
  }

  if (err.name === 'CredentialsProviderError' || err.name === 'InvalidAccessKeyId') {
    return res.status(500).json({ error: 'Error de credenciales AWS.', code: 'AWS_AUTH_ERROR', timestamp });
  }

  res.status(500).json({
    error: 'Error interno del servidor.',
    code: 'INTERNAL_ERROR',
    timestamp,
  });
}

module.exports = errorMiddleware;
