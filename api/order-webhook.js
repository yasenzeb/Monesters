// api/order-webhook.js - triggered rebuild for new env variables
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    const { type, record, old_record } = payload;

    if (!type || !record) {
      return res.status(400).json({ success: false, error: 'حمولة غير صالحة' });
    }

    const adminPhone = process.env.ADMIN_PHONE; // رقم هاتف الآدمن الأساسي

    if (type === 'INSERT') {
      // 1. إرسال الرسالة إلى العميل
      const customerMessage = `أزيك يا ${record.customer_name} 👋❤️

معاك خدمة عملاء MONSTERS 👟🔥

بنشكرك على ثقتك بينا، وحابين نأكد لحضرتك إن طلبك وصل بنجاح ✅

فريقنا هيتواصل معاك في أقرب وقت لتأكيد الحجز ومراجعة تفاصيل الأوردر.

لو عندك أي استفسار بخصوص المقاسات أو الموديلات أو الشحن، إحنا جاهزين لمساعدتك في أي وقت 💬

شكراً لاختيارك MONSTERS ❤️

MONSTERS — كل خطوة ليها هيبة 👟🔥`;

      await sendWhatsApp(record.phone, customerMessage);

      // 2. إرسال تفاصيل الطلب للآدمن
      if (adminPhone) {
        // تنسيق قائمة المنتجات للآدمن
        let itemsText = '';
        if (Array.isArray(record.items)) {
          itemsText = record.items.map(i => {
            const parts = [];
            if (i.size) parts.push(`مقاس: ${i.size}`);
            if (i.color) parts.push(`لون: ${i.color}`);
            const detail = parts.length ? ` [${parts.join(' — ')}]` : '';
            return `• ${i.name}${detail}\n  الكمية: ${i.qty || 1} | السعر: EGP ${(i.finalPrice || i.price) * (i.qty || 1)}`;
          }).join('\n\n');
        }

        const paymentLabel = record.payment_method === 'cod' ? 'الدفع عند الاستلام' : 'تحويل إلكتروني';
        const hasReceipt = record.receipt_url ? 'نعم (تم الرفع بالفعل)' : 'لا (بانتظار الرفع)';

        const adminMessage = `━━━━━━━━━━━━━━ 🛒 طلب جديد MONSTERS ━━━━━━━━━━━━━━
🆔 رقم الطلب: ${record.order_number}
👤 العميل: ${record.customer_name}
📞 رقم الهاتف: ${record.phone}
📍 المحافظة: ${record.governorate}
🏠 العنوان: ${record.address}
💳 طريقة الدفع: ${paymentLabel}
📝 ملاحظات: ${record.notes || 'لا يوجد'}

📦 المنتجات:
${itemsText}

💰 المجموع: EGP ${record.subtotal}
🚚 الشحن: EGP ${record.shipping_cost}
✅ الإجمالي: EGP ${record.total}

🖼️ تم رفع إيصال الدفع: ${hasReceipt}`;

        await sendWhatsApp(adminPhone, adminMessage);
      }
    }

    if (type === 'UPDATE') {
      const oldReceipt = old_record?.receipt_url;
      const newReceipt = record?.receipt_url;

      // عند رفع الإيصال وتحديثه
      if (newReceipt && newReceipt !== oldReceipt) {
        if (adminPhone) {
          const receiptMessage = `━━━━━━━━━━━━━━ 📎 إيصال تحويل جديد MONSTERS ━━━━━━━━━━━━━━
🆔 رقم الطلب: ${record.order_number}
👤 العميل: ${record.customer_name}
📞 رقم الهاتف: ${record.phone}
📍 المحافظة: ${record.governorate}

🖼️ رابط صورة التحويل:
${newReceipt}`;

          await sendWhatsApp(adminPhone, receiptMessage);
        }
      }
    }

    return res.status(200).json({ success: true, message: 'تمت معالجة البيانات وإرسال الرسائل' });

  } catch (err) {
    console.error('[Webhook Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// دالة إرسال رسائل الواتساب
async function sendWhatsApp(phone, message) {
  // تهيئة رقم الهاتف بالصيغة الدولية (مصر افتراضياً)
  let formattedPhone = phone.trim();
  if (formattedPhone.startsWith('01')) {
    formattedPhone = '20' + formattedPhone.slice(1);
  } else if (formattedPhone.startsWith('1')) {
    formattedPhone = '20' + formattedPhone;
  } else if (!formattedPhone.startsWith('20') && formattedPhone.length === 11) {
    formattedPhone = '2' + formattedPhone;
  }

  // 1. التحقق من وجود إعدادات Green API
  const greenInstanceId = process.env.GREENAPI_INSTANCE_ID || process.env.WHATSAPP_INSTANCE_ID;
  const greenToken = process.env.GREENAPI_TOKEN || process.env.WHATSAPP_TOKEN;
  const greenApiUrl = process.env.GREENAPI_API_URL || process.env.WHATSAPP_API_URL;

  // نحدد ما إذا كنا نستخدم Green API
  const isGreenApi = greenInstanceId || (greenApiUrl && greenApiUrl.includes('greenapi'));

  if (isGreenApi && greenToken) {
    const baseUrl = (greenApiUrl || 'https://api.green-api.com').replace(/\/$/, '');
    
    // إذا لم نجد الـ Instance ID بشكل منفصل ولكن الرابط يحتوي على رقم مثل 7107658162 أو waInstance
    let instanceId = greenInstanceId;
    if (!instanceId && baseUrl) {
      const match = baseUrl.match(/waInstance(\d+)/i);
      if (match) {
        instanceId = match[1];
      }
    }

    if (instanceId) {
      // تنظيف الرابط الرئيسي ليكون فقط الدومين (بدون waInstance)
      let cleanBaseUrl = baseUrl;
      if (cleanBaseUrl.includes('/waInstance')) {
        cleanBaseUrl = cleanBaseUrl.split('/waInstance')[0];
      }
      
      const url = `${cleanBaseUrl}/waInstance${instanceId}/sendMessage/${greenToken}`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: `${formattedPhone}@c.us`,
            message: message
          })
        });
        const result = await response.json();
        console.log(`Green API WhatsApp send result for ${formattedPhone}:`, result);
        return result;
      } catch (err) {
        console.error(`Failed to send Green API message to ${formattedPhone}:`, err);
      }
      return;
    }
  }

  // 2. التحقق من وجود إعدادات UltraMsg (الافتراضية القديمة)
  const apiUrl = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_TOKEN;

  if (!apiUrl || !token) {
    console.warn('WhatsApp Gateway credentials are missing (WHATSAPP_API_URL/WHATSAPP_TOKEN or GREENAPI_INSTANCE_ID/GREENAPI_TOKEN)');
    return;
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        to: formattedPhone,
        body: message
      })
    });

    const result = await response.json();
    console.log(`UltraMsg send result for ${formattedPhone}:`, result);
    return result;
  } catch (err) {
    console.error(`Failed to send UltraMsg message to ${formattedPhone}:`, err);
  }
}
