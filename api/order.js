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
  console.log('[API /order]', {
    method: req.method,
    headers: {
      origin: req.headers['origin'],
      contentType: req.headers['content-type'],
    }
  });

  // ══════════════════════════════════════════════════════════════
  // ⭐ STEP 1: Set CORS headers FIRST (قبل أي شيء)
  // ══════════════════════════════════════════════════════════════
  setCorsHeaders(req, res);

  // ══════════════════════════════════════════════════════════════
  // ⭐ STEP 2: Handle OPTIONS preflight request
  // ══════════════════════════════════════════════════════════════
  if (req.method === 'OPTIONS') {
    console.log('[API /order] Handling OPTIONS preflight');
    return res.status(200).end();  // ✅ 200 وليس 204
  }

  // ══════════════════════════════════════════════════════════════
  // ⭐ STEP 3: Check HTTP method (يجب يكون POST)
  // ══════════════════════════════════════════════════════════════
  if (req.method !== 'POST') {
    console.error('[API /order] Invalid method:', req.method);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed — استخدم POST فقط',
      receivedMethod: req.method,
      allowedMethods: ['POST', 'OPTIONS']
    });
  }

  // ── Rate Limit: 5 طلبات/ساعة لكل IP ──
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  
  console.log('[API /order] Client IP:', ip);
  
  if (isRateLimited(`order:${ip}`, 5, 60 * 60 * 1000)) {
    console.warn('[API /order] Rate limit exceeded for IP:', ip);
    return res.status(429).json({ 
      success: false, 
      error: 'محاولات كثيرة، حاول لاحقاً.' 
    });
  }

  try {
    const {
      name, phone, gov, address, notes,
      payment, items, subtotal, shipping, total,
    } = req.body || {};

    console.log('[API /order] Received data:', {
      name: name ? '✓' : '✗',
      phone: phone ? '✓' : '✗',
      gov: gov ? '✓' : '✗',
      address: address ? '✓' : '✗',
      payment: payment ? '✓' : '✗',
      items: Array.isArray(items) ? items.length : '✗',
    });

    // ── التحقق من المدخلات الأساسية ──
    if (!name?.trim() || !phone?.trim() || !gov || !address?.trim() || !payment) {
      console.error('[API /order] Missing required fields');
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات ناقصة - تأكد من: الاسم، الهاتف، المحافظة، العنوان، طريقة الدفع'
      });
    }

    if (!['cod', 'transfer'].includes(payment)) {
      console.error('[API /order] Invalid payment method:', payment);
      return res.status(400).json({ 
        success: false, 
        error: 'طريقة دفع غير مقبولة - استخدم cod أو transfer' 
      });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      console.error('[API /order] Invalid items array');
      return res.status(400).json({ 
        success: false, 
        error: 'السلة غير صالحة - يجب أن تحتوي على 1-50 منتج' 
      });
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

    console.log('[API /order] Calculations:', {
      calcSubtotal,
      parsedShipping,
      parsedTotal,
      itemsCount: safeItems.length
    });

    const orderNumber = generateOrderNumber();
    console.log('[API /order] Generated order number:', orderNumber);

    // ── إدراج الطلب في Supabase ──
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

    if (error) {
      console.error('[API /order] Supabase insert error:', error);
      throw error;
    }

    console.log('[API /order] Order created successfully:', data.id);

    // ── إشعار Pushover (بدون مقاطعة الـ response) ──
    const payLabel  = payment === 'cod' ? 'عند الاستلام' : 'تحويل إلكتروني';
    const itemsText = safeItems
      .map(i => `• ${i.name} ×${i.qty} = EGP ${i.finalPrice * i.qty}`)
      .join('\n');

    // أرسل الإشعار بدون انتظار
    notifyPushover(
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
    ).catch(e => console.error('[Pushover Error]', e));

    // ── الرد الناجح ──
    console.log('[API /order] SUCCESS - Returning response');
    return res.status(201).json({
      success: true,
      order: {
        order_number: data.order_number,
        id:           data.id,
      },
    });

  } catch (err) {
    console.error('[API /order] CRITICAL ERROR:', err);
    return res.status(500).json({ 
      success: false, 
      error: safeError(err),
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}