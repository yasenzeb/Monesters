import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NTFY_TOPIC = 'monsters-orders-x7k2'; // غيّره لاسمك السري

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { name, phone, gov, address, notes, payment, items, subtotal, shipping, total } = req.body;

    // تحقق من البيانات
    if (!name || !phone || !gov || !address || !items?.length) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }

    // رقم الطلب
    const orderNumber = 'ORD-' + Date.now().toString().slice(-6);

    // حفظ في Supabase
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        order_number: orderNumber,
        customer_name: name,
        phone,
        governorate: gov,
        address,
        notes: notes || '',
        payment_method: payment,
        items: items,
        subtotal,
        shipping_cost: shipping,
        total,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // إشعار ntfy
    const itemsList = items.map(i =>
      `• ${i.name}${i.size ? ' ('+i.size+')' : ''} × ${i.qty || 1} = ${(i.finalPrice||i.price)*(i.qty||1)} ج.م`
    ).join('\n');

    const message = [
      `👤 ${name} | 📱 ${phone}`,
      `📍 ${gov} — ${address}`,
      `💳 ${payment === 'cod' ? 'دفع عند الاستلام' : 'تحويل إلكتروني'}`,
      ``,
      `📦 المنتجات:`,
      itemsList,
      ``,
      `💰 المجموع: ${subtotal} ج.م`,
      `🚚 الشحن: ${shipping} ج.م`,
      `✅ الإجمالي: ${total} ج.م`,
      notes ? `📝 ملاحظات: ${notes}` : ''
    ].filter(Boolean).join('\n');

    // أرسل الإشعار (non-blocking — لو فشل مش هيأثر على الطلب)
    fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      body: message,
      headers: {
        'Title': `🛒 طلب جديد #${orderNumber} — ${name}`,
        'Priority': 'high',
        'Tags': 'shopping_cart,moneybag'
      }
    }).catch(err => console.error('ntfy error:', err));

    return res.status(201).json({
      success: true,
      order: {
        order_number: orderNumber,
        ...order
      }
    });

  } catch (err) {
    console.error('[API /orders]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}