// api/order.js
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, safeError } from './_auth.js';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Rate limiting بسيط في الذاكرة (per serverless instance) ──
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000; // نافذة دقيقة واحدة
  const maxRequests = 10;
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > maxRequests;
}

// ── التحقق من رقم الهاتف المصري ──
function isValidEgyptPhone(phone) {
  return /^(01[0-2,5]\d{8})$/.test((phone || '').trim());
}

// ── إنشاء رقم طلب بعشوائية مضافة ──
function generateOrderNumber() {
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return 'ORD-' + Date.now().toString().slice(-6) + rand;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── Rate Limiting ──
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ success: false, error: 'طلبات كثيرة جداً، انتظر دقيقة.' });
  }

  try {
    const { name, phone, gov, address, notes, payment, items, subtotal, shipping, total } = req.body || {};

    // ── التحقق من الحقول المطلوبة ──
    if (!name || !phone || !gov || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }

    // ── التحقق من رقم الهاتف ──
    if (!isValidEgyptPhone(phone)) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف غير صحيح' });
    }

    // ── التحقق من القيم المالية ──
    const parsedSubtotal = parseFloat(subtotal);
    const parsedShipping = parseFloat(shipping);
    const parsedTotal    = parseFloat(total);
    if (
      isNaN(parsedSubtotal) || parsedSubtotal < 0 ||
      isNaN(parsedShipping) || parsedShipping < 0 ||
      isNaN(parsedTotal)    || parsedTotal < 0
    ) {
      return res.status(400).json({ success: false, error: 'قيم مالية غير صحيحة' });
    }

    // ── التحقق من حقل payment ──
    const allowedPayments = ['cod', 'transfer'];
    if (!allowedPayments.includes(payment)) {
      return res.status(400).json({ success: false, error: 'طريقة دفع غير صالحة' });
    }

    // ── حد عدد المنتجات لمنع الـ payload inflation ──
    if (items.length > 50) {
      return res.status(400).json({ success: false, error: 'عدد المنتجات تجاوز الحد المسموح' });
    }

    const orderNumber = generateOrderNumber();

    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        order_number:   orderNumber,
        customer_name:  name.substring(0, 100),
        phone:          phone.trim(),
        governorate:    gov.substring(0, 50),
        address:        address.substring(0, 300),
        notes:          (notes || '').substring(0, 500),
        payment_method: payment,
        items:          items,
        subtotal:       parsedSubtotal,
        shipping_cost:  parsedShipping,
        total:          parsedTotal,
        status:         'pending',
        created_at:     new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, order: { order_number: orderNumber, ...order } });

  } catch (err) {
    console.error('[API /order]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}