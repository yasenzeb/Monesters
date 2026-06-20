// api/whatsapp-webhook.js
import { setCorsHeaders, requireAdmin, safeError } from './_auth.js';

// ── منع SSRF: فقط نسمح باتصالات لخوادم موثوقة ──
function isSafeServerUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    // يجب أن يكون HTTPS فقط
    if (parsed.protocol !== 'https:') return false;
    // لا نسمح بـ localhost أو IPs الداخلية
    const host = parsed.hostname.toLowerCase();
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedHosts.includes(host)) return false;
    // منع Private IP ranges
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) return false;
    if (/^169\.254\./.test(host)) return false; // Link-local
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── مصادقة Admin مطلوبة ──
  if (!requireAdmin(req)) {
    return res.status(401).json({ success: false, error: 'غير مصرح' });
  }

  try {
    const { action, phone, message } = req.body || {};

    // ── التحقق من المدخلات ──
    if (!action || !phone || !message) {
      return res.status(400).json({ success: false, error: 'action, phone, و message مطلوبون' });
    }

    const allowedActions = ['send', 'notify'];
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ success: false, error: 'action غير مسموح' });
    }

    const whatsappServerUrl = process.env.WHATSAPP_SERVER_URL;

    if (!whatsappServerUrl) {
      return res.status(500).json({ success: false, error: 'سيرفر الواتساب الخارجي غير معرف' });
    }

    // ── التحقق من أن رابط السيرفر آمن (منع SSRF) ──
    if (!isSafeServerUrl(whatsappServerUrl)) {
      console.error('[Security] Blocked unsafe WHATSAPP_SERVER_URL:', whatsappServerUrl);
      return res.status(500).json({ success: false, error: 'تكوين سيرفر غير آمن' });
    }

    const response = await fetch(`${whatsappServerUrl}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: String(action).substring(0, 20),
        phone:  String(phone).substring(0, 20),
        message: String(message).substring(0, 2000)
      }),
      signal: AbortSignal.timeout(10_000) // timeout 10 ثوان
    });

    const result = await response.json();
    return res.status(200).json({ success: true, data: result });

  } catch (err) {
    console.error('[Vercel Webhook Error]', err);
    return res.status(500).json({ success: false, error: safeError(err) });
  }
}