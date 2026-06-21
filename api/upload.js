import { IncomingForm } from 'formidable';
import { readFileSync } from 'fs';
import { setCorsHeaders, requireAdmin, safeError } from './_auth.js';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });// ── في api/upload.js، قبل JSON.parse ──
export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── PHASE 5: Check body size before parsing ──
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const MAX_SIZE = 13 * 1024 * 1024; // 13MB

  if (contentLength > MAX_SIZE) {
    return res.status(400).json({ success: false, error: 'حجم الملف كبير جداً (الحد الأقصى 13 ميجابايت)' });
  }

  // ... rest of the code
}
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

    if (contentType.includes('multipart/form-data')) {
      // FormData (file upload from admin)
      const form = new IncomingForm({ maxFileSize: 10 * 1024 * 1024 });
      const { files } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve({ fields, files });
        });
      });
      const file = files.file?.[0] || files.file;
      if (!file) return res.status(400).json({ success: false, error: 'No file provided.' });
      const fileBuffer = readFileSync(file.filepath || file.path);
      const mimeType = file.mimetype || file.type || 'image/jpeg';
      base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    } else {
      // JSON base64
      const body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(JSON.parse(data)));
      });
      base64Data = body.data;
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
