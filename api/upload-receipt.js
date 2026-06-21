// api/upload-receipt.js — رفع صورة الإيصال من العميل (بدون auth، بـ rate limit)
import { IncomingForm }  from 'formidable';
import { readFileSync }  from 'fs';
import { createHash }    from 'crypto';
import { setCorsHeaders, isRateLimited, safeError } from './_auth.js';

export const config = { api: { bodyParser: false } };

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── Rate Limit: 5 رفعات كل 10 دقائق لكل IP ──
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  if (isRateLimited(`receipt:${ip}`, 5, 10 * 60 * 1000)) {
    return res.status(429).json({ success: false, error: 'محاولات كثيرة، حاول لاحقاً.' });
  }

  // ── التحقق من حجم الطلب قبل المعالجة ──
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 13 * 1024 * 1024) {
    return res.status(400).json({ success: false, error: 'حجم الملف كبير جداً (الحد الأقصى 10 MB).' });
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ success: false, error: 'خطأ في إعدادات الخادم.' });
    }

    const contentType = req.headers['content-type'] || '';
    let base64Data;

    if (contentType.includes('multipart/form-data')) {
      // ── رفع عبر FormData ──
      const form = new IncomingForm({
        maxFileSize:    MAX_SIZE_BYTES,
        keepExtensions: true,
        multiples:      false,
      });

      const { files } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) =>
          err ? reject(err) : resolve({ fields, files })
        );
      });

      // دعم أسماء مختلفة للحقل
      const file = files.file?.[0] || files.file
        || Object.values(files)[0]?.[0]
        || Object.values(files)[0];

      if (!file) {
        return res.status(400).json({ success: false, error: 'لم يُرسل ملف.' });
      }

      const mimeType = file.mimetype || file.type || '';
      if (!ALLOWED_MIME.has(mimeType)) {
        return res.status(400).json({
          success: false,
          error: 'نوع الملف غير مدعوم. يُسمح بـ JPG، PNG، GIF، WEBP فقط.',
        });
      }

      const buf  = readFileSync(file.filepath || file.path);
      base64Data = `data:${mimeType};base64,${buf.toString('base64')}`;

    } else {
      // ── رفع عبر JSON Base64 ──
      let rawBody = '';
      await new Promise((resolve, reject) => {
        req.on('data', c   => { rawBody += c; });
        req.on('end',  ()  => resolve());
        req.on('error', e  => reject(e));
      });

      let parsed;
      try { parsed = JSON.parse(rawBody); }
      catch { return res.status(400).json({ success: false, error: 'بيانات JSON غير صالحة.' }); }

      base64Data = parsed.data;
    }

    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'لا توجد بيانات صورة.' });
    }

    // ── رفع إلى Cloudinary في مجلد الإيصالات ──
    const timestamp = Math.round(Date.now() / 1000);
    const folder    = 'monsters-receipts';
    const sig = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const formData = new URLSearchParams();
    formData.append('file',      base64Data);
    formData.append('api_key',   apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('folder',    folder);
    formData.append('signature', sig);

    const cloudRes  = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );
    const cloudData = await cloudRes.json();

    if (!cloudRes.ok || cloudData.error) {
      throw new Error(cloudData.error?.message || 'Cloudinary upload failed');
    }

    return res.status(200).json({ success: true, url: cloudData.secure_url });

  } catch (err) {
    console.error('[API /upload-receipt]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}
