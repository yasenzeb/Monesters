import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NTFY_TOPIC = 'monsters-orders-x7k2'; // غيّره لأي اسم سري تحبه

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

    // ── Validation ──
    if (!name || !phone || !gov || !address || !items?.length) {
      return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }

    // ── Order Number ──
    const orderNumber = 'ORD-' + Date.now().toString().slice(-6);

    // ── Save to Supabase ──
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        order_number:   orderNumber,
        customer_name:  name,
        phone,
        governorate:    gov,
        address,
        notes:          notes || '',
        payment_method: payment,
        items:          items,
        subtotal,
        shipping_cost:  shipping,
        total,
        status:         'pending',
        created_at:     new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // ── Build ntfy message ──
    const paymentLabel = payment === 'cod' ? 'دفع عند الاستلام' : 'تحويل إلكتروني';

    const itemsList = items
      .map(i => `• ${i.name}${i.size ? ' (مقاس: ' + i.size + ')' : ''}${i.color ? ' - ' + i.color : ''} × ${i.qty || 1} = EGP ${(i.finalPrice || i.price) * (i.qty || 1)}`)
      .join('\n');

    const message = [
      `👤 ${name}`,
      `📱 ${phone}`,
      `📍 ${gov} — ${address}`,
      `💳 ${paymentLabel}`,
      notes ? `📝 ${notes}` : null,
      ``,
      `📦 المنتجات:`,
      itemsList,
      ``,
      `💰 المجموع: EGP ${subtotal}`,
      `🚚 الشحن:   EGP ${shipping}`,
      `✅ الإجمالي: EGP ${total}`
    ].filter(line => line !== null).join('\n');

    // ── Send ntfy notification (non-blocking) ──
    fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      body:   message,
      headers: {
        'Title':    `🛒 طلب جديد #${orderNumber} — ${name}`,
        'Priority': 'high',
        'Tags':     'shopping_cart,moneybag',
        'Content-Type': 'text/plain; charset=utf-8'
      }
    }).catch(err => console.error('[ntfy error]', err));

    // ── Response ──
    return res.status(201).json({
      success: true,
      order: {
        order_number: orderNumber,
        ...order
      }
    });

  } catch (err) {
    console.error('[API /order]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}