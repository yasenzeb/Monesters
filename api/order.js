// api/order.js — إنشاء طلب جديد مع إشعار Pushover
import { createClient } from '@supabase/supabase-js';
import { isRateLimited, safeError } from './_auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── توليد رقم طلب فريد ──
function generateOrderNumber() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MNS-${date}-${rand}`;
}

// ── إرسال إشعار Pushover ──
async function sendPushoverNotification(title, message) {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  
  console.log('[Pushover] Token exists:', !!token);
  console.log('[Pushover] User exists:', !!user);
  
  if (!token || !user) {
    console.error('[Pushover] Missing credentials');
    return false;
  }

  try {
    const body = new URLSearchParams({
      token: token,
      user: user,
      title: title.substring(0, 250),
      message: message.substring(0, 1024),
      priority: '1',
      sound: 'cashregister',
    });

    const resp = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    const result = await resp.json();
    console.log('[Pushover] Response:', result);

    if (!resp.ok) {
      console.error('[Pushover] Failed:', result);
      return false;
    }

    console.log('[Pushover] ✅ Sent successfully!');
    return true;
  } catch (e) {
    console.error('[Pushover] Error:', e.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// ⭐ MAIN HANDLER
// ══════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  // ══════════════════════════════════════════════════════════════
  // ⭐ STEP 1: CORS headers للجميع
  // ══════════════════════════════════════════════════════════════
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token, x-admin-password');
  res.setHeader('Access-Control-Max-Age', '86400');

  // ══════════════════════════════════════════════════════════════
  // ⭐ STEP 2: Handle OPTIONS - الرد فوراً
  // ══════════════════════════════════════════════════════════════
  if (req.method === 'OPTIONS') {
    console.log('[API /order] ✅ OPTIONS - 204');
    return res.status(204).end();  // 204 No Content
  }

  // ══════════════════════════════════════════════════════════════
  // ⭐ STEP 3: Only POST
  // ══════════════════════════════════════════════════════════════
  if (req.method !== 'POST') {
    console.error('[API /order] ❌ Invalid method:', req.method);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed. Use POST.`,
    });
  }

  console.log('[API /order] 📥 POST request received');

  // ── Rate Limit ──
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  
  if (isRateLimited(`order:${ip}`, 5, 60 * 60 * 1000)) {
    console.warn('[API /order] ⚠️ Rate limit exceeded:', ip);
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

    console.log('[API /order] 📦 Data:', {
      name: name || 'missing',
      phone: phone || 'missing',
      gov: gov || 'missing',
      items: items?.length || 0,
    });

    // ── التحقق ──
    if (!name?.trim() || !phone?.trim() || !gov || !address?.trim() || !payment) {
      return res.status(400).json({ 
        success: false, 
        error: 'بيانات ناقصة'
      });
    }

    if (!['cod', 'transfer'].includes(payment)) {
      return res.status(400).json({ 
        success: false, 
        error: 'طريقة دفع غير مقبولة' 
      });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ 
        success: false, 
        error: 'السلة غير صالحة' 
      });
    }

    // ── تنظيف البيانات ──
    const safeItems = items.map(item => ({
      id:         String(item.id || '').substring(0, 100),
      name:       String(item.name || '').substring(0, 200),
      price:      Number(item.price) || 0,
      qty:        Math.max(1, Math.min(99, parseInt(item.qty) || 1)),
      size:       item.size ? String(item.size).substring(0, 10) : null,
      color:      item.color ? String(item.color).substring(0, 50) : null,
      finalPrice: Number(item.finalPrice) || Number(item.price) || 0,
    }));

    // ── حساب المجموع ──
    const calcSubtotal = safeItems.reduce((acc, i) => acc + i.finalPrice * i.qty, 0);
    const parsedShipping = Math.max(0, Number(shipping) || 0);
    const parsedTotal = Math.round(calcSubtotal + parsedShipping);

    const orderNumber = generateOrderNumber();
    console.log('[API /order] 🆔 Order number:', orderNumber);

    // ── إدراج في Supabase ──
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        order_number: orderNumber,
        customer_name: String(name).trim().substring(0, 100),
        phone: String(phone).trim().substring(0, 20),
        governorate: String(gov).trim().substring(0, 50),
        address: String(address).trim().substring(0, 500),
        notes: notes ? String(notes).trim().substring(0, 500) : null,
        payment_method: payment,
        items: safeItems,
        subtotal: calcSubtotal,
        shipping_cost: parsedShipping,
        total: parsedTotal,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      console.error('[API /order] DB Error:', error);
      throw error;
    }

    console.log('[API /order] ✅ Order created:', data.id);

    // ── Pushover ──
    const payLabel = payment === 'cod' ? 'الدفع عند الاستلام' : 'تحويل إلكتروني';
    const itemsText = safeItems
      .map(i => `• ${i.name} ×${i.qty} = EGP ${i.finalPrice * i.qty}`)
      .join('\n');

    const adminMessage = `━━━━━━━━━━━━━━ 🛒 طلب جديد ━━━━━━━━━━━━━━
🆔 رقم: ${orderNumber}
👤 العميل: ${name}
📞 الهاتف: ${phone}
📍 المحافظة: ${gov}
🏠 العنوان: ${address}
💳 الدفع: ${payLabel}
📝 ملاحظات: ${notes || 'لا يوجد'}

📦 المنتجات:
${itemsText}

💰 المجموع: EGP ${calcSubtotal}
🚚 الشحن: EGP ${parsedShipping}
✅ الإجمالي: EGP ${parsedTotal}`;

    // إرسال الإشعار (لا ننتظر)
    sendPushoverNotification(`🛒 طلب جديد #${orderNumber}`, adminMessage)
      .then(sent => console.log('[Pushover] Sent:', sent))
      .catch(err => console.error('[Pushover] Error:', err));

    // ── الرد ──
    return res.status(201).json({
      success: true,
      order: {
        order_number: data.order_number,
        id: data.id,
      },
    });

  } catch (err) {
    console.error('[API /order] 💥 ERROR:', err);
    return res.status(500).json({ 
      success: false, 
      error: safeError(err),
    });
  }
}