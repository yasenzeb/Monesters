// api/_auth.js — مساعد مشترك للأمان في جميع ملفات API

const ALLOWED_ORIGINS = [
  'https://monsters11.com',
  'https://www.monsters11.com',
];

/**
 * يضع CORS headers مقيدة بالدومين المصرح به.
 * في بيئة التطوير يقبل أي أصل.
 */
export function setCorsHeaders(req, res) {
  const origin = req.headers['origin'] || '';
  const isDev  = process.env.NODE_ENV !== 'production';
  const allowed = isDev || ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin',  allowed || ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-password');
  res.setHeader('Vary', 'Origin');
}

/**
 * يتحقق من وجود كلمة المرور الصحيحة في الـ header.
 * يُرجع true عند النجاح، false عند الفشل.
 */
export function requireAdmin(req) {
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) {
    // إذا لم تُعيَّن متغير البيئة، ارفض في الإنتاج دائماً
    if (process.env.NODE_ENV === 'production') return false;
    return true; // بيئة تطوير فقط
  }
  const provided = req.headers['x-admin-password'] || '';
  // مقارنة آمنة ضد timing attacks
  if (provided.length !== adminPw.length) return false;
  try {
    const { timingSafeEqual } = require('crypto');
    return timingSafeEqual(Buffer.from(provided), Buffer.from(adminPw));
  } catch {
    return provided === adminPw;
  }
}

/**
 * يُرجع رسالة خطأ آمنة دون كشف stack trace للمستخدم.
 */
export function safeError(err) {
  if (process.env.NODE_ENV !== 'production') return err?.message || 'خطأ غير معروف';
  return 'حدث خطأ داخلي، يرجى المحاولة مرة أخرى.';
}

// ── Rate limiting بسيط في الذاكرة (per serverless instance) ──
const rateLimitMap = new Map();

/**
 * يتحقق من تجاوز IP للحد المسموح.
 * @param {string} ip
 * @param {number} maxRequests — الحد الأقصى للطلبات في النافذة الزمنية
 * @param {number} windowMs   — النافذة الزمنية بالمليثانية
 */
export function isRateLimited(ip, maxRequests = 10, windowMs = 60_000) {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > maxRequests;
}
