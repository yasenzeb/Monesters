// Shared auth helper for all API routes
// Uses ADMIN_SECRET_KEY env var to validate admin tokens
// Uses crypto.timingSafeEqual to prevent timing attacks

import { createHmac, timingSafeEqual } from 'crypto';

const ALLOWED_ORIGINS = [
  'https://monsters11.com',
  'https://www.monsters11.com'
];

// In development, also allow localhost
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500');
}

export function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Same-origin requests (no origin header) - allow for Vercel same-domain
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-token');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

export function generateToken(payload) {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret) return null;
  const data = JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 }); // 24h
  const sig = createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(data).toString('base64') + '.' + sig;
}

export function verifyToken(token) {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret || !token) return false;
  try {
    const [dataB64, sig] = token.split('.');
    if (!dataB64 || !sig) return false;
    const data = Buffer.from(dataB64, 'base64').toString();
    const expectedSig = createHmac('sha256', secret).update(data).digest('hex');
    // Timing-safe comparison
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return false;
    const parsed = JSON.parse(data);
    if (parsed.exp < Date.now()) return false; // Expired
    return true;
  } catch {
    return false;
  }
}

export function requireAdmin(req) {
  const token = req.headers['x-admin-token'] || '';
  return verifyToken(token);
}

export function safeError(err) {
  // Don't leak internal error details in production
  if (process.env.NODE_ENV === 'production') {
    return 'حدث خطأ داخلي. يرجى المحاولة لاحقاً.';
  }
  return err.message || 'Unknown error';
}

export function sanitizeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
