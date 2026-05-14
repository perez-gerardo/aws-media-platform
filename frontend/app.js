/**
 * app.js — Frontend de S3 Gallery
 *
 * Módulos separados por responsabilidad (SRP aplicado también al frontend):
 *  - Config:    constantes y configuración global
 *  - Validator: validación de archivos en cliente
 *  - API:       comunicación con el backend
 *  - UI:        manipulación del DOM (toast, modal, galería, preview)
 *  - App:       inicialización y event listeners
 *
 * IMPORTANTE DE SEGURIDAD:
 * Este archivo NO contiene credenciales de AWS.
 * Solo se comunica con el backend local que es quien genera las URLs firmadas.
 */

'use strict';

/* ─────────────────────────────────────────────
   CONFIG
   ───────────────────────────────────────────── */
const Config = {
  API_BASE:      'http://localhost:3000/api',
  MAX_SIZE_MB:   5,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_EXTS:  ['.jpg', '.jpeg', '.png', '.webp'],
};

/* ─────────────────────────────────────────────
   VALIDATOR — SRP: solo validación en cliente
   ───────────────────────────────────────────── */
const Validator = {
  /**
   * Valida un File antes de enviarlo al backend.
   * @returns {{ valid: boolean, error?: string }}
   */
  validateFile(file) {
    if (!file) return { valid: false, error: 'No se seleccionó ningún archivo.' };

    if (!Config.ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: `Tipo no permitido: ${file.type}. Usa JPEG, PNG o WebP.` };
    }

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!Config.ALLOWED_EXTS.includes(ext)) {
      return { valid: false, error: `Extensión no permitida: ${ext}.` };
    }

    if (file.size > Config.MAX_SIZE_MB * 1024 * 1024) {
      return { valid: false, error: `El archivo supera ${Config.MAX_SIZE_MB} MB.` };
    }

    return { valid: true };
  },
};

/* ─────────────────────────────────────────────
   API — SRP: solo comunicación con el backend
   ───────────────────────────────────────────── */
const API = {
  /**
   * Solicita una presigned URL al backend para subir un archivo.
   */
  async requestUploadUrl(file) {
    const res = await fetch(`${Config.API_BASE}/images/upload-url`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename:    file.name,
        contentType: file.type,
        sizeBytes:   file.size,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error del servidor: ${res.status}`);
    }

    return res.json(); // { uploadUrl, key, requiredHeaders }
  },

  /**
   * Sube el archivo DIRECTAMENTE a S3 usando la presigned URL.
   * El archivo NO pasa por el backend: va navegador → S3.
   */
  async uploadToS3(uploadUrl, file, requiredHeaders, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          // Log the full S3 XML error response for debugging
          console.error('S3 Error Response:', xhr.responseText);
          reject(new Error(`S3 respondió con status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Error de red al subir a S3.')));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      if (requiredHeaders) {
        Object.entries(requiredHeaders).forEach(([h, v]) => xhr.setRequestHeader(h, v));
      }
      xhr.send(file);
    });
  },

  /**
   * Obtiene la lista de imágenes desde el backend.
   */
  async getImages() {
    const res = await fetch(`${Config.API_BASE}/images`);
    if (!res.ok) throw new Error(`Error al listar imágenes: ${res.status}`);
    return res.json();
  },

  /**
   * Elimina una imagen por su key.
   */
  async deleteImage(key) {
    const url = `${Config.API_BASE}/images?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Error al eliminar: ${res.status}`);
    return res.json();
  },
};

/* ─────────────────────────────────────────────
   UI — SRP: solo manipulación del DOM
   ───────────────────────────────────────────── */
const UI = {
  // ── Elementos del DOM ──────────────────────
  els: {
    dropZone:       document.getElementById('dropZone'),
    fileInput:      document.getElementById('fileInput'),
    uploadBtn:      document.getElementById('uploadBtn'),
    filePreview:    document.getElementById('filePreview'),
    previewThumb:   document.getElementById('previewThumb'),
    previewName:    document.getElementById('previewName'),
    previewSize:    document.getElementById('previewSize'),
    clearFile:      document.getElementById('clearFile'),
    progressBar:    document.getElementById('progressBar'),
    progressFill:   document.getElementById('progressFill'),
    progressLabel:  document.getElementById('progressLabel'),
    galleryGrid:    document.getElementById('galleryGrid'),
    galleryStatus:  document.getElementById('galleryStatus'),
    refreshBtn:     document.getElementById('refreshBtn'),
    bucketBadge:    document.getElementById('bucketBadge'),
    toastContainer: document.getElementById('toastContainer'),
    modalOverlay:   document.getElementById('modalOverlay'),
    modalConfirm:   document.getElementById('modalConfirm'),
    modalCancel:    document.getElementById('modalCancel'),
  },

  // ── Toast ───────────────────────────────────
  toast(message, type = 'info', duration = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    this.els.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), duration);
  },

  // ── Modal de confirmación ───────────────────
  _pendingDelete: null,

  showDeleteModal(key) {
    this._pendingDelete = key;
    this.els.modalOverlay.hidden = false;
  },

  hideModal() {
    this._pendingDelete = null;
    this.els.modalOverlay.hidden = true;
  },

  // ── File Preview ────────────────────────────
  showPreview(file) {
    const url = URL.createObjectURL(file);
    this.els.previewThumb.src = url;
    this.els.previewName.textContent = file.name;
    this.els.previewSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    this.els.filePreview.hidden = false;
    this.els.uploadBtn.disabled = false;
  },

  clearPreview() {
    this.els.filePreview.hidden = true;
    this.els.previewThumb.src = '';
    this.els.uploadBtn.disabled = true;
    this.els.fileInput.value = '';
  },

  // ── Progress ────────────────────────────────
  showProgress(percent) {
    this.els.progressBar.hidden = false;
    this.els.progressFill.style.width = `${percent}%`;
    this.els.progressLabel.textContent = percent < 100 ? `Subiendo… ${percent}%` : '✅ ¡Listo!';
  },

  hideProgress() {
    setTimeout(() => {
      this.els.progressBar.hidden = true;
      this.els.progressFill.style.width = '0%';
    }, 1200);
  },

  // ── Upload button ────────────────────────────
  setUploadLoading(loading) {
    const btn = this.els.uploadBtn;
    if (loading) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;"></span><span>Subiendo…</span>';
    } else {
      btn.innerHTML = '<span class="btn__icon">⬆️</span><span class="btn__text">Subir a S3</span>';
      btn.disabled = false;
    }
  },

  // ── Gallery ─────────────────────────────────
  showGalleryLoading() {
    this.els.galleryStatus.innerHTML = '<div class="spinner"></div><p>Cargando imágenes…</p>';
    this.els.galleryStatus.classList.remove('hidden');
    this.els.galleryGrid.innerHTML = '';
  },

  showGalleryEmpty() {
    this.els.galleryStatus.innerHTML = '<span style="font-size:3rem">📭</span><p>Sin imágenes todavía.<br>¡Sube tu primera foto!</p>';
    this.els.galleryStatus.classList.remove('hidden');
  },

  showGalleryError(msg) {
    this.els.galleryStatus.innerHTML = `<span style="font-size:2.5rem">⚠️</span><p>${msg}</p>`;
    this.els.galleryStatus.classList.remove('hidden');
  },

  renderGallery(images) {
    if (!images.length) { this.showGalleryEmpty(); return; }

    this.els.galleryStatus.classList.add('hidden');
    this.els.galleryGrid.innerHTML = images.map((img) => `
      <article class="image-card" data-key="${img.key}">
        <img class="image-card__thumb"
             src="${img.viewUrl}"
             alt="${img.filename}"
             loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><text y=\\'50\\'>⚠️</text></svg>'" />
        <div class="image-card__body">
          <p class="image-card__name" title="${img.filename}">${img.filename}</p>
          <p class="image-card__meta">${formatSize(img.size)} · ${formatDate(img.lastModified)}</p>
          <div class="image-card__actions">
            <a class="btn btn--ghost" href="${img.viewUrl}" target="_blank" rel="noopener"
               title="Ver en tamaño completo">👁 Ver</a>
            <button class="btn btn--danger" data-delete="${img.key}"
               title="Eliminar imagen">🗑 Borrar</button>
          </div>
        </div>
      </article>
    `).join('');
  },

  // ── Badge ────────────────────────────────────
  setBadgeConnected(bucket) {
    this.els.bucketBadge.textContent = `🟢 ${bucket}`;
    this.els.bucketBadge.classList.add('connected');
  },

  setBadgeError() {
    this.els.bucketBadge.textContent = '🔴 Sin conexión';
  },
};

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/* ─────────────────────────────────────────────
   APP — Inicialización y flujo principal
   ───────────────────────────────────────────── */
let selectedFile = null;

/**
 * Carga y renderiza la galería desde el backend.
 */
async function loadGallery() {
  UI.showGalleryLoading();
  try {
    const images = await API.getImages();
    UI.renderGallery(images);
    UI.setBadgeConnected('lab-imagenes-perez');
  } catch (err) {
    UI.showGalleryError('No se pudo conectar al servidor. ¿Está corriendo el backend?');
    UI.setBadgeError();
    UI.toast(err.message, 'error');
  }
}

/**
 * Flujo completo de subida:
 * 1. Validar en cliente
 * 2. Pedir presigned URL al backend
 * 3. PUT directo a S3 (navegador → S3, sin pasar backend)
 * 4. Refrescar galería
 */
async function uploadFile() {
  if (!selectedFile) return;

  // 1. Validar en cliente (primera línea de defensa)
  const { valid, error } = Validator.validateFile(selectedFile);
  if (!valid) { UI.toast(error, 'error'); return; }

  UI.setUploadLoading(true);
  UI.showProgress(0);

  try {
    // 2. Pedir presigned URL (el backend re-valida también)
    UI.toast('Generando URL segura…', 'info');
    const { uploadUrl, requiredHeaders } = await API.requestUploadUrl(selectedFile);

    // 3. PUT directo a S3 (las credenciales NUNCA llegan al navegador)
    UI.toast('Subiendo a S3…', 'info');
    await API.uploadToS3(uploadUrl, selectedFile, requiredHeaders, (pct) => UI.showProgress(pct));

    UI.toast('¡Imagen subida con éxito! 🎉', 'success');
    UI.clearPreview();
    selectedFile = null;
    await loadGallery();
  } catch (err) {
    UI.toast(`Error al subir: ${err.message}`, 'error');
  } finally {
    UI.setUploadLoading(false);
    UI.hideProgress();
  }
}

/**
 * Elimina una imagen tras confirmación en el modal.
 */
async function deleteImage(key) {
  try {
    await API.deleteImage(key);
    UI.toast('Imagen eliminada. 🗑', 'success');
    await loadGallery();
  } catch (err) {
    UI.toast(`Error al eliminar: ${err.message}`, 'error');
  } finally {
    UI.hideModal();
  }
}

/* ── Event Listeners ───────────────────────── */

// Selección de archivo (input o drag & drop)
function handleFileSelect(file) {
  if (!file) return;
  const { valid, error } = Validator.validateFile(file);
  if (!valid) { UI.toast(error, 'error'); return; }
  selectedFile = file;
  UI.showPreview(file);
}

UI.els.fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

// Drag & Drop
UI.els.dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  UI.els.dropZone.classList.add('drag-over');
});
UI.els.dropZone.addEventListener('dragleave', () => UI.els.dropZone.classList.remove('drag-over'));
UI.els.dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  UI.els.dropZone.classList.remove('drag-over');
  handleFileSelect(e.dataTransfer.files[0]);
});

// Limpiar selección
UI.els.clearFile.addEventListener('click', () => {
  selectedFile = null;
  UI.clearPreview();
});

// Subir
UI.els.uploadBtn.addEventListener('click', uploadFile);

// Refrescar galería
UI.els.refreshBtn.addEventListener('click', loadGallery);

// Delegar clicks en la galería (botones de eliminar)
UI.els.galleryGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-delete]');
  if (btn) UI.showDeleteModal(btn.dataset.delete);
});

// Modal de confirmación
UI.els.modalConfirm.addEventListener('click', () => {
  if (UI._pendingDelete) deleteImage(UI._pendingDelete);
});
UI.els.modalCancel.addEventListener('click', () => UI.hideModal());
UI.els.modalOverlay.addEventListener('click', (e) => {
  if (e.target === UI.els.modalOverlay) UI.hideModal();
});

// Teclado: ESC cierra modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') UI.hideModal();
});

// ── Inicio ──────────────────────────────────
loadGallery();
