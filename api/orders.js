// api/order.js - نسخة مبسطة للاختبار
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token, x-admin-password');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS - رد فوري
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // فقط POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  // اختبار بسيط
  return res.status(200).json({ 
    success: true, 
    message: 'API works!', 
    received: req.body 
  });
}