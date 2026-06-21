// api/order.js — إنشاء طلب جديد من صفحة الـ Checkout (بدون auth)
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, isRateLimited, safeError } from './_auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── توليد رقم طلب فريد ──
function generateOrderNumber() {
  const d    = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MNS-${date}-${rand}`;
}

// ── إرسال إشعار Pushover ──
// Env vars مطلوبة: PUSHOVER_TOKEN, PUSHOVER_USER
async function notifyPushover(title, message) {
  const token = process.env.PUSHOVER_TOKEN;
  const user  = process.env.PUSHOVER_USER;
  if (!token || !user) return; // تجاهل صامت إذا لم تُضبط
  try {
    const body = new URLSearchParams({
      token,
      user,
      title:    title.substring(0, 250),
      message:  message.substring(0, 1024),
      priority: '1',
      sound:    'cashregister',
    });
    const resp = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      body,
    });
    if (!resp.ok) console.warn('[Pushover] HTTP', resp.status);
  } catch (e) {
    console.warn('[Pushover] Failed:', e.message);
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── Rate Limit: 5 طلبات/ساعة لكل IP ──
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  if (isRateLimited(`order:${ip}`, 5, 60 * 60 * 1000)) {
    return res.status(429).json({ success: false, error: 'محاولات كثيرة، حاول لاحقاً.' });
  }

  try {
    const {
      name, phone, gov, address, notes,
      payment, items, subtotal, shipping, total,
    } = req.body || {};

    // ── التحقق من المدخلات الأساسية ──
    if (!name?.trim() || !phone?.trim() || !gov || !address?.trim() || !payment) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة.' });
    }
    if (!['cod', 'transfer'].includes(payment)) {
      return res.status(400).json({ success: false, error: 'طريقة دفع غير مقبولة.' });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ success: false, error: 'السلة غير صالحة.' });
    }

    // ── تنظيف بنود الطلب ──
    const safeItems = items.map(item => ({
      id:         String(item.id   || '').substring(0, 100),
      name:       String(item.name || '').substring(0, 200),
      price:      Number(item.price)      || 0,
      qty:        Math.max(1, Math.min(99, parseInt(item.qty) || 1)),
      size:       item.size  ? String(item.size).substring(0, 10)  : null,
      color:      item.color ? String(item.color).substring(0, 50) : null,
      finalPrice: Number(item.finalPrice) || Number(item.price)    || 0,
    }));

    // ── التحقق من المبالغ (منع التلاعب) ──
    const calcSubtotal = safeItems.reduce(
      (acc, i) => acc + i.finalPrice * i.qty, 0
    );
    const parsedShipping = Math.max(0, Number(shipping) || 0);
    const parsedTotal    = Math.round(calcSubtotal + parsedShipping);

    const orderNumber = generateOrderNumber();

    const { data, error } = await supabase
      .from('orders')
      .insert([{
        order_number:   orderNumber,
        customer_name:  String(name).trim().substring(0, 100),
        phone:          String(phone).trim().substring(0, 20),
        governorate:    String(gov).trim().substring(0, 50),
        address:        String(address).trim().substring(0, 500),
        notes:          notes ? String(notes).trim().substring(0, 500) : null,
        payment_method: payment,
        items:          safeItems,
        subtotal:       calcSubtotal,
        shipping_cost:  parsedShipping,
        total:          parsedTotal,
        status:         'pending',
      }])
      .select()
      .single();

    if (error) throw error;

    // ── إشعار Pushover ──
    const payLabel  = payment === 'cod' ? 'عند الاستلام' : 'تحويل إلكتروني';
    const itemsText = safeItems
      .map(i => `• ${i.name} ×${i.qty} = EGP ${i.finalPrice * i.qty}`)
      .join('\n');

    await notifyPushover(
      `🛒 طلب جديد — MONSTERS`,
      [
        `رقم: ${orderNumber}`,
        `👤 ${data.customer_name}`,
        `📞 ${data.phone}`,
        `📍 ${data.governorate}`,
        `💳 ${payLabel}`,
        `💰 EGP ${parsedTotal} (شحن: ${parsedShipping})`,
        ``,
        itemsText,
      ].join('\n')
    );

    return res.status(201).json({
      success: true,
      order: {
        order_number: data.order_number,
        id:           data.id,
      },
    });

  } catch (err) {
    console.error('[API POST /order]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}
