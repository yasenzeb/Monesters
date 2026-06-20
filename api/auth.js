import { createHmac } from 'crypto';
import { setCorsHeaders, generateToken, safeError } from './_auth.js';

// ── Rate Limiting على Login: 5 محاولات كل 15 دقيقة ──
const loginAttempts = new Map();

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60_000; // 15 دقيقة
  const maxAttempts = 5;
  const entry = loginAttempts.get(ip) || { count: 0, start: now, lockedUntil: 0 };

  // هل محظور حالياً؟
  if (entry.lockedUntil > now) {
    const waitMin = Math.ceil((entry.lockedUntil - now) / 60_000);
    return { allowed: false, message: `تم إيقاف تسجيل الدخول مؤقتاً. انتظر ${waitMin} دقيقة.` };
  }

  // تجديد النافذة الزمنية
  if (now - entry.start > windowMs) {
    loginAttempts.set(ip, { count: 1, start: now, lockedUntil: 0 });
    return { allowed: true };
  }

  entry.count++;
  loginAttempts.set(ip, entry);

  if (entry.count > maxAttempts) {
    entry.lockedUntil = now + windowMs;
    loginAttempts.set(ip, entry);
    return { allowed: false, message: 'محاولات كثيرة جداً. سيتم فتح الدخول بعد 15 دقيقة.' };
  }

  return { allowed: true };
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const rateCheck = checkLoginRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return res.status(429).json({ success: false, error: rateCheck.message });
  }

  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'كلمة المرور مطلوبة' });
    }

    // حد طول كلمة المرور لمنع هجمات الـ DoS عبر هاش طويل
    if (password.length > 200) {
      return res.status(400).json({ success: false, error: 'كلمة المرور طويلة جداً' });
    }

    const storedHash = process.env.ADMIN_PASSWORD_HASH;
    if (!storedHash) {
      return res.status(500).json({ success: false, error: 'لم يتم تهيئة كلمة مرور الأدمن' });
    }

    // Hash the provided password with SHA-256 + salt and compare
    // storedHash format: salt:hash
    const [salt, expectedHash] = storedHash.split(':');
    if (!salt || !expectedHash) {
      return res.status(500).json({ success: false, error: 'تهيئة غير صحيحة' });
    }

    const inputHash = createHmac('sha256', salt).update(password).digest('hex');

    // ── مقارنة آمنة من الـ Timing Attacks ──
    const { timingSafeEqual } = await import('crypto');
    const inputBuf    = Buffer.from(inputHash, 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const isValid = inputBuf.length === expectedBuf.length && timingSafeEqual(inputBuf, expectedBuf);

    if (!isValid) {
      return res.status(401).json({ success: false, error: 'كلمة المرور غير صحيحة' });
    }

    const token = generateToken({ role: 'admin', loginAt: Date.now() });
    if (!token) {
      return res.status(500).json({ success: false, error: 'فشل إنشاء الجلسة' });
    }

    return res.status(200).json({ success: true, token });

  } catch (err) {
    console.error('[API /auth]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}
