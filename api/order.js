// api/order.js
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders, safeError } from './_auth.js';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Shipping Rates (same as frontend) ──
const SHIPPING_RATES = {
  'جنوب سيناء': 160, 'مطروح': 160, 'الوادي الجديد': 160, 'البحر الأحمر': 160,
  'القاهرة': 95,  'الجيزة': 95,  'بورسعيد': 95, 'السويس': 95,
  'المنيا': 120,  'أسيوط': 120,  'سوهاج': 120,  'قنا': 120,
  'الأقصر': 120,  'أسوان': 120,  'بني سويف': 120, 'الفيوم': 120,
  'الإسكندرية': 120, 'الدقهلية': 120, 'البحيرة': 120,  'الغربية': 120,
  'الإسماعيلية': 120, 'المنوفية': 120, 'القليوبية': 120, 'دمياط': 120,
  'الشرقية': 120, 'كفر الشيخ': 120, 'شمال سيناء': 120
};

// ── Rate limiting ──
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
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

// ── Validate Egyptian phone ──
function isValidEgyptPhone(phone) {
  return /^01[0125]\d{8}$/.test((phone || '').trim());
}

// ── Generate order number ──
function generateOrderNumber() {
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return 'ORD-' + Date.now().toString().slice(-6) + rand;
}

// ── Calculate final price with discount ──
function calcPrice(product) {
  const price = product.price || 0;
  const discountType = product.discount_type || 'none';
  const discountValue = parseFloat(product.discount_value) || 0;

  if (discountType === 'none' || discountValue <= 0) return price;
  if (discountType === 'amount') return Math.max(price - discountValue, 0);
  if (discountType === 'percent') return Math.max(Math.round(price - (price * discountValue / 100)), 0);
  return price;
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

    // ── Validate required fields ──
    if (!name || !phone || !gov || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }

    // ── Validate phone ──
    if (!isValidEgyptPhone(phone)) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف غير صحيح' });
    }

    // ── Validate payment method ──
    const allowedPayments = ['cod', 'transfer'];
    if (!allowedPayments.includes(payment)) {
      return res.status(400).json({ success: false, error: 'طريقة دفع غير صالحة' });
    }

    // ── Max items limit ──
    if (items.length > 50) {
      return res.status(400).json({ success: false, error: 'عدد المنتجات تجاوز الحد المسموح' });
    }

    // ── PHASE 2: Fetch real product data from database ──
    const productIds = items.map(i => i.id).filter(Boolean);
    if (productIds.length === 0) {
      return res.status(400).json({ success: false, error: 'لا توجد منتجات صالحة' });
    }

    const { data: dbProducts, error: dbError } = await supabase
      .from('products')
      .select('id, name, type, price, discount_type, discount_value')
      .in('id', productIds);

    if (dbError) {
      console.error('[DB Error]', dbError);
      return res.status(500).json({ success: false, error: 'خطأ في قاعدة البيانات' });
    }

    // ── Verify all products exist ──
    const dbProductMap = {};
    dbProducts.forEach(p => { dbProductMap[p.id] = p; });

    const missingProducts = productIds.filter(id => !dbProductMap[id]);
    if (missingProducts.length > 0) {
      return res.status(400).json({
        success: false,
        error: `بعض المنتجات غير موجودة: ${missingProducts.join(', ')}`
      });
    }

    // ── Calculate real prices ──
    let realSubtotal = 0;
    const validatedItems = items.map(item => {
      const dbProduct = dbProductMap[item.id];
      const realPrice = calcPrice(dbProduct);
      const qty = parseInt(item.qty) || 1;
      const itemTotal = realPrice * qty;
      realSubtotal += itemTotal;

      return {
        id: item.id,
        name: dbProduct.name,
        price: dbProduct.price,
        finalPrice: realPrice,
        qty: qty,
        size: item.size || null,
        color: item.color || null,
        type: dbProduct.type
      };
    });

    // ── Verify shipping cost ──
    const realShipping = SHIPPING_RATES[gov] || 0;
    const clientShipping = parseFloat(shipping) || 0;
    if (Math.abs(realShipping - clientShipping) > 0.01) {
      return res.status(400).json({
        success: false,
        error: 'تكلفة الشحن غير صحيحة'
      });
    }

    // ── Verify total ──
    const realTotal = realSubtotal + realShipping;
    const clientTotal = parseFloat(total) || 0;
    if (Math.abs(realTotal - clientTotal) > 0.01) {
      return res.status(400).json({
        success: false,
        error: 'المبلغ الإجمالي غير صحيح'
      });
    }

    // ── Generate order number ──
    const orderNumber = generateOrderNumber();

    // ── Insert order into database ──
    const { data: order, error: insertError } = await supabase
      .from('orders')
      .insert([{
        order_number: orderNumber,
        customer_name: name.substring(0, 100),
        phone: phone.trim(),
        governorate: gov.substring(0, 50),
        address: address.substring(0, 300),
        notes: (notes || '').substring(0, 500),
        payment_method: payment,
        items: validatedItems,
        subtotal: realSubtotal,
        shipping_cost: realShipping,
        total: realTotal,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // ── PHASE 1: Send Pushover notification from server ──
    try {
      // Call /api/notify internally
      const notifyUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/notify`
        : 'http://localhost:3000/api/notify';

      const orderSummary = validatedItems.map(i =>
        `• ${i.name} (مقاس: ${i.size || 'غير محدد'}) × ${i.qty} = EGP ${i.finalPrice * i.qty}`
      ).join('\n');

      const paymentLabel = payment === 'cod' ? 'الدفع عند الاستلام' : 'تحويل إلكتروني';

      const notifyPayload = {
        title: `🛒 طلب جديد #${orderNumber}`,
        message: `━━━━━━━━━━━━━━ 🛒 طلب جديد ━━━━━━━━━━━━━━\n` +
                 `🆔 رقم الطلب: ${orderNumber}\n` +
                 `👤 العميل: ${name}\n` +
                 `📞 الهاتف: ${phone}\n` +
                 `📍 المحافظة: ${gov}\n` +
                 `💳 الدفع: ${paymentLabel}\n\n` +
                 `📦 المنتجات:\n${orderSummary}\n\n` +
                 `💰 المجموع: EGP ${realSubtotal}\n` +
                 `🚚 الشحن: EGP ${realShipping}\n` +
                 `✅ الإجمالي: EGP ${realTotal}`,
        type: 'order'
      };

      await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifyPayload)
      });
    } catch (notifyErr) {
      // Don't fail the order if notification fails
      console.error('[Notify Error]', notifyErr);
    }

    return res.status(201).json({
      success: true,
      order: {
        order_number: orderNumber,
        ...order
      }
    });

  } catch (err) {
    console.error('[API /order]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}