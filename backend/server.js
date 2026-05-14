require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const imagesRouter    = require('./src/routes/images.routes');
const errorMiddleware = require('./src/middleware/error.middleware');

const REQUIRED_ENV = ['AWS_REGION', 'S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.error(`[FATAL] Variable de entorno faltante: ${key}`);
    process.exit(1);
  }
});

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500'],
  methods: ['GET', 'POST', 'DELETE'],
}));

app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intenta más tarde.', code: 'RATE_LIMITED' },
});
app.use('/api', limiter);

app.use('/api/images', imagesRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), bucket: process.env.S3_BUCKET });
});

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log(`║  🚀 API corriendo en http://localhost:${PORT}  ║`);
  console.log(`║  📦 Bucket: ${process.env.S3_BUCKET}`);
  console.log(`║  🌎 Región: ${process.env.AWS_REGION}`);
  console.log('╚════════════════════════════════════════╝');
});
