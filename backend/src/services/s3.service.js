const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

const s3Client = require('../config/s3.config');

const BUCKET          = process.env.S3_BUCKET;
const UPLOAD_URL_EXPIRY = 300;
const VIEW_URL_EXPIRY   = 900;
const PREFIX            = 'originales/';

function buildSafeKey(filename) {
  const ext      = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
  const unique   = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  return `${PREFIX}${unique}-${basename}${ext}`;
}

async function generateUploadUrl(filename, contentType) {
  const key = buildSafeKey(filename);

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: UPLOAD_URL_EXPIRY });
  return { uploadUrl, key };
}

async function listImages() {
  const response = await s3Client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX })
  );

  const contents = (response.Contents || []).filter(obj => obj.Size > 0);

  const images = await Promise.all(
    contents.map(async (obj) => {
      const viewUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }),
        { expiresIn: VIEW_URL_EXPIRY }
      );
      return {
        key: obj.Key,
        filename: obj.Key.replace(PREFIX, '').replace(/^\d+-[a-f0-9]+-/, ''),
        size: obj.Size,
        lastModified: obj.LastModified,
        viewUrl,
      };
    })
  );

  return images.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
}

async function deleteImage(key) {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { generateUploadUrl, listImages, deleteImage };
