// api/auth.js — نقطة تحقق server-side من كلمة المرور
import { setCorsHeaders, isRateLimited } from './_auth.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── Rate Limiting: 10 محاولات / دقيقة per IP ──
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (isRateLimited(clientIp, 10, 60_000)) {
    return res.status(429).json({ success: false, error: 'محاولات كثيرة، انتظر دقيقة.' });
  }

  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'كلمة المرور مطلوبة.' });
  }

  const adminPw = process.env.ADMIN_PASSWORD;

  if (!adminPw) {
    console.error('[API /auth] ADMIN_PASSWORD env var is not set');
    return res.status(500).json({ success: false, error: 'الخادم غير مُهيأ.' });
  }

  // مقارنة آمنة ضد timing attacks
  let match = false;
  try {
    const { timingSafeEqual } = await import('crypto');
    if (password.length === adminPw.length) {
      match = timingSafeEqual(Buffer.from(password), Buffer.from(adminPw));
    }
  } catch {
    match = password === adminPw;
  }

  if (!match) {
    return res.status(401).json({ success: false, error: 'كلمة المرور غلط!' });
  }

  return res.status(200).json({ success: true });
}
