# ☁️ S3 Image Gallery

A full-stack web application for securely uploading, listing, previewing, and deleting images using **Amazon S3 Presigned URLs**. Built as part of a cloud computing laboratory focused on AWS storage, IAM security, and encryption best practices.

## 📸 Preview

> Dark mode interface with drag & drop upload, real-time gallery, and toast notifications.

## ✨ Features

- **Drag & Drop** image upload with real-time progress bar
- **Presigned URL** pattern — files go directly from browser to S3, credentials never exposed to the client
- **Gallery view** with auto-refreshing presigned download URLs (15-min expiry)
- **Delete with confirmation** modal
- **Dual validation** — enforced on both frontend and backend
- **Rate limiting** — 100 requests per 15-minute window per IP
- **SSE-S3 encryption** enforced on every uploaded object
- **Dark mode** UI with glassmorphism design

## 🏗️ Architecture

```
Browser (Frontend)
    │
    │  POST /api/images/upload-url  { filename, contentType, sizeBytes }
    ▼
Backend (Express API)
    │  ── Validates MIME type + extension + size
    │  ── Generates safe filename with crypto
    │  ── Signs PutObjectCommand (5 min expiry)
    │  ◄─ Returns { uploadUrl, key }
    │
    │  PUT uploadUrl + body=File  ──────────────────► Amazon S3
    │  (file travels browser → S3, backend never touches it)
    │
    │  GET /api/images  ─────────────────────────────► Amazon S3
    │  ◄─ Returns [{ key, filename, size, viewUrl }]
    ▼
Browser renders gallery
```

## 🧱 SOLID Architecture

| File | Principle |
|---|---|
| `src/config/s3.config.js` | **SRP** — only configures the S3 client |
| `src/validators/upload.validator.js` | **SRP + OCP** — isolated, extensible validation |
| `src/services/s3.service.js` | **SRP + DIP + OCP** — all AWS logic in one place |
| `src/controllers/images.controller.js` | **SRP + DIP** — only handles HTTP req/res |
| `src/routes/images.routes.js` | **SRP** — only declares routes |
| `src/middleware/error.middleware.js` | **SRP** — centralized error handling |

## 🛠️ Tech Stack

**Backend**
- Node.js + Express 5
- AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- `express-rate-limit`, `dotenv`, `cors`

**Frontend**
- HTML5 + Vanilla CSS + Vanilla JavaScript (no frameworks)
- Drag & Drop API, XHR with upload progress, Fetch API

**Cloud**
- Amazon S3 (private bucket, SSE-S3 encryption, versioning, lifecycle rules)
- IAM user with least-privilege policy

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- An AWS account with an S3 bucket and an IAM user with the following permissions:
  - `s3:PutObject`
  - `s3:GetObject`
  - `s3:DeleteObject`
  - `s3:ListBucket`

### 1. Clone the repository

```bash
git clone https://github.com/your-username/s3-image-gallery.git
cd s3-image-gallery
```

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the `backend/` folder:

```env
PORT=3000
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

> ⚠️ **Never commit `.env` to Git.** It is already listed in `.gitignore`.

### 4. Configure CORS on your S3 bucket

In the AWS Console, go to your bucket → **Permissions** → **CORS** and paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "DELETE"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 5. Run the server

```bash
node server.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
s3-image-gallery/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── s3.config.js
│   │   ├── validators/
│   │   │   └── upload.validator.js
│   │   ├── services/
│   │   │   └── s3.service.js
│   │   ├── controllers/
│   │   │   └── images.controller.js
│   │   ├── routes/
│   │   │   └── images.routes.js
│   │   └── middleware/
│   │       └── error.middleware.js
│   ├── server.js
│   ├── .env              ← not committed
│   ├── .gitignore
│   └── package.json
└── frontend/
    ├── index.html
    ├── app.js
    └── styles.css
```

## 🔒 Security Highlights

- **AWS credentials are never sent to the browser.** The frontend only receives short-lived presigned URLs.
- **Presigned URLs expire** — 5 minutes for uploads, 15 minutes for viewing.
- **Double validation** — file type and size are checked on the frontend AND re-validated server-side before signing.
- **Filename sanitization** — dangerous characters and path traversal patterns are removed with regex before generating the S3 key.
- **Rate limiting** — prevents brute-force and URL generation abuse.
- **SSE-S3 encryption** — enforced via `ServerSideEncryption: 'AES256'` on every `PutObjectCommand`.
- **IAM least-privilege** — the IAM user only has permissions for the specific bucket operations needed.

## 📋 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/images/upload-url` | Returns a presigned PUT URL for direct S3 upload |
| `GET` | `/api/images` | Lists all images with presigned view URLs |
| `DELETE` | `/api/images?key=originales/xxx` | Deletes an image by key |
| `GET` | `/health` | Health check endpoint |

### POST `/api/images/upload-url`

**Request body:**
```json
{
  "filename": "photo.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 1048576
}
```

**Response:**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "key": "originales/1234567890-abc123-photo.jpg"
}
```

## 🧪 Validation Rules

| Rule | Frontend | Backend |
|---|---|---|
| Allowed types | `image/jpeg`, `image/png`, `image/webp` | ✅ |
| Allowed extensions | `.jpg`, `.jpeg`, `.png`, `.webp` | ✅ |
| Max file size | 5 MB | ✅ |

## 📄 License

MIT
