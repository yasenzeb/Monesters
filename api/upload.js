import { IncomingForm } from 'formidable';
import { readFileSync } from 'fs';
import { setCorsHeaders, requireAdmin, safeError } from './_auth.js';

export const config = {
  api: { bodyParser: false }
};

// أنواع الصور المسموح بها فقط
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── مصادقة Admin مطلوبة ──
  if (!requireAdmin(req)) {
    return res.status(401).json({ success: false, error: 'غير مصرح — يجب تسجيل دخول الأدمن' });
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ success: false, error: 'Cloudinary env vars not configured.' });
    }

    const contentType = req.headers['content-type'] || '';

    let base64Data;
    let mimeType = 'image/jpeg';

    if (contentType.includes('multipart/form-data')) {
      // FormData (file upload from admin)
      const form = new IncomingForm({ maxFileSize: MAX_FILE_SIZE });
      const { files } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve({ fields, files });
        });
      });

      const file = files.file?.[0] || files.file;
      if (!file) return res.status(400).json({ success: false, error: 'No file provided.' });

      // ── التحقق من نوع الملف ──
      mimeType = file.mimetype || file.type || '';
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return res.status(400).json({
          success: false,
          error: 'نوع الملف غير مسموح. الأنواع المسموحة: JPEG, PNG, WebP, GIF'
        });
      }

      // ── التحقق من حجم الملف ──
      const fileSize = file.size || 0;
      if (fileSize > MAX_FILE_SIZE) {
        return res.status(400).json({ success: false, error: 'حجم الملف يتجاوز 5 MB' });
      }

      const fileBuffer = readFileSync(file.filepath || file.path);

      // ── التحقق من الـ Magic Bytes ──
      if (!isValidImageBuffer(fileBuffer, mimeType)) {
        return res.status(400).json({ success: false, error: 'محتوى الملف لا يطابق نوعه' });
      }

      base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    } else {
      // JSON base64
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });

      base64Data = body.data;

      // ── التحقق من base64 ──
      if (!base64Data || typeof base64Data !== 'string') {
        return res.status(400).json({ success: false, error: 'No image data provided.' });
      }

      // التحقق من الـ MIME في base64 prefix
      const match = base64Data.match(/^data:(image\/[a-z]+);base64,/);
      if (!match || !ALLOWED_MIME_TYPES.has(match[1])) {
        return res.status(400).json({ success: false, error: 'نوع الصورة غير مسموح' });
      }
    }

    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'No image data provided.' });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'monsters-store';

    const { createHash } = await import('crypto');
    const sig = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');

    const formData = new URLSearchParams();
    formData.append('file', base64Data);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('signature', sig);

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    const cloudinaryData = await cloudinaryRes.json();

    if (!cloudinaryRes.ok || cloudinaryData.error) {
      throw new Error(cloudinaryData.error?.message || 'Cloudinary upload failed');
    }

    return res.status(200).json({
      success: true,
      url: cloudinaryData.secure_url,
      public_id: cloudinaryData.public_id
    });

  } catch (err) {
    console.error('[API /upload]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}

/**
 * التحقق من Magic Bytes للصور
 */
function isValidImageBuffer(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;
  const b = buffer;
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
    case 'image/png':
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
    case 'image/gif':
      return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
    case 'image/webp':
      return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
    default:
      return false;
  }
}