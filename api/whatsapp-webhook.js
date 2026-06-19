// api/whatsapp-webhook.js
export default async function handler(req, res) {
  // تفعيل الـ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { action, phone, message } = req.body;

    // إرسال البيانات إلى السيرفر الخارجي (الجسد) المستضيف للواتساب ليتنشط
    const whatsappServerUrl = process.env.WHATSAPP_SERVER_URL; // نضع هنا رابط السيرفر الخارجي لاحقاً
    
    if (!whatsappServerUrl) {
      return res.status(500).json({ success: false, error: 'سيرفر الواتساب الخارجي غير معرف بالـ Env' });
    }

    const response = await fetch(`${whatsappServerUrl}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, phone, message })
    });

    const result = await response.json();
    return res.status(200).json({ success: true, data: result });

  } catch (err) {
    console.error('[Vercel Webhook Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}