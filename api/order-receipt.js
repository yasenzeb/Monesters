// api/order-receipt.js
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, safeError } from './_auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// أنماط URLs المسموح بها للإيصالات (Cloudinary فقط)
const ALLOWED_URL_PATTERNS = [
  /^https:\/\/res\.cloudinary\.com\//,
  /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/storage\//
];

function isAllowedReceiptUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return ALLOWED_URL_PATTERNS.some(pattern => pattern.test(url));
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { order_number, receipt_url } = req.body || {};

    if (!order_number || !receipt_url) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }

    // ── التحقق من صيغة رقم الطلب ──
    const safeOrderNumber = String(order_number).replace(/[^A-Z0-9-]/g, '').substring(0, 30);
    if (!safeOrderNumber) {
      return res.status(400).json({ success: false, error: 'رقم طلب غير صحيح' });
    }

    // ── التحقق من أن رابط الإيصال من مصدر موثوق ──
    if (!isAllowedReceiptUrl(receipt_url)) {
      return res.status(400).json({ success: false, error: 'رابط الإيصال غير مسموح به' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ receipt_url: receipt_url.substring(0, 1000) })
      .eq('order_number', safeOrderNumber)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    return res.status(200).json({ success: true, order: { order_number: data.order_number } });

  } catch (err) {
    console.error('[API /order-receipt]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}