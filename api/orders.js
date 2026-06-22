import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, requireAdmin, isRateLimited, safeError } from './_auth.js';

const ALLOWED_RECEIPT_URL_PATTERNS = [
  /^https:\/\/res\.cloudinary\.com\//,
  /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/storage\//,
];

function isAllowedReceiptUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return ALLOWED_RECEIPT_URL_PATTERNS.some(p => p.test(url));
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── PATCH: تحديث receipt_url — متاح للعميل بدون auth ──
  if (req.method === 'PATCH') {
    try {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || 'unknown';
      if (isRateLimited(`order-receipt:${ip}`, 10, 10 * 60 * 1000)) {
        return res.status(429).json({ success: false, error: 'محاولات كثيرة، حاول لاحقاً.' });
      }

      const { order_number, receipt_url } = req.body || {};
      if (!order_number || !receipt_url) {
        return res.status(400).json({ success: false, error: 'بيانات ناقصة.' });
      }

      const safeOrderNumber = String(order_number).replace(/[^A-Z0-9\-]/g, '').substring(0, 30);
      if (!safeOrderNumber) {
        return res.status(400).json({ success: false, error: 'رقم الطلب غير صحيح.' });
      }

      if (!isAllowedReceiptUrl(receipt_url)) {
        return res.status(400).json({ success: false, error: 'رابط الإيصال غير مسموح به.' });
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ receipt_url: receipt_url.substring(0, 1000) })
        .eq('order_number', safeOrderNumber)
        .select('order_number')
        .single();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
      }

      return res.status(200).json({ success: true, order: { order_number: data.order_number } });
    } catch (err) {
      console.error('[API /orders PATCH]', err);
      return res.status(500).json({ success: false, error: safeError(err) });
    }
  }

  if (!requireAdmin(req)) {
    return res.status(401).json({ success: false, error: 'غير مصرح.' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, orders: data || [] });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ success: false, error: 'id مطلوب.' });
      }

      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'تم حذف الطلب.' });
    }

    if (req.method === 'PUT') {
      const { id }     = req.query;
      const { status } = req.body || {};
      const allowed    = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

      if (!id || !status || !allowed.includes(status)) {
        return res.status(400).json({ success: false, error: 'بيانات غير صالحة.' });
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, order: data });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (err) {
    console.error('[API /orders]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}
