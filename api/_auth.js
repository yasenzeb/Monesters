// api/_auth.js — مساعد مشترك للأمان في جميع ملفات API
import { createHmac, timingSafeEqual } from 'crypto';

const ALLOWED_ORIGINS = [
  'https://monsters11.com',
  'https://www.monsters11.com',
];

/**
 * يضع CORS headers مقيدة بالدومين المصرح به.
 */
export function setCorsHeaders(req, res) {
  const origin = req.headers['origin'] || '';
  const isDev  = process.env.NODE_ENV !== 'production';
  const allowed = isDev || ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin',  allowed || ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-password,x-admin-token');
  res.setHeader('Vary', 'Origin');
}

/**
 * ── PHASE 3: Token Generation ──
 * Generate JWT-like token using HMAC (no external libs)
 */
export function generateToken() {
  const secret = process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error('ADMIN_TOKEN_SECRET or ADMIN_PASSWORD not set');
  }

  const exp = Math.floor(Date.now() / 1000) + (2 * 60 * 60); // 2 hours
  const iat = Math.floor(Date.now() / 1000);
  const payload = { exp, iat };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('hex');

  return `${payloadBase64}.${signature}`;
}

/**
 * ── PHASE 3: Token Verification ──
 * Verify token signature and expiration
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadBase64, signature] = parts;
  const secret = process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) return false;

  try {
    // Verify signature
    const expectedSignature = createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSignature, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expBuf)) return false;

    // Verify expiration
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * ── PHASE 3: Updated requireAdmin ──
 * Verify token from x-admin-token header
 * Fallback to password for backward compatibility (optional)
 */
export function requireAdmin(req) {
  // Primary: check token
  const token = req.headers['x-admin-token'] || '';
  if (token && verifyToken(token)) {
    return true;
  }

  // Fallback: check password (for backward compatibility during transition)
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) return false;

  const provided = req.headers['x-admin-password'] || '';
  if (provided.length !== adminPw.length) return false;

  try {
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

// ── Rate limiting ──
const rateLimitMap = new Map();

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