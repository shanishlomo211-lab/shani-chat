// Vercel Serverless Function - Register a new visitor in Google Sheets
// Called when the user enters name + phone in step 2 of the intro.
// Receives: { name, phone }
// Returns:  { ok: true, sessionId }

function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, phone } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ error: 'חסרים פרטים' });
    }

    const cleanName = String(name).trim().substring(0, 100);
    const cleanPhone = String(phone).trim().replace(/[^\d+\-\s]/g, '').substring(0, 20);

    if (cleanName.length < 2) {
      return res.status(400).json({ error: 'שם קצר מדי' });
    }
    if (cleanPhone.replace(/[^\d]/g, '').length < 8) {
      return res.status(400).json({ error: 'טלפון לא תקין' });
    }

    const sessionId = generateSessionId();
    const sheetsUrl = process.env.SHEETS_WEBHOOK_URL;

    // Fire-and-forget POST to the Google Apps Script webhook.
    // If it fails, we still return sessionId so the flow continues.
    if (sheetsUrl) {
      try {
        // Get client IP from Vercel headers
        const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

        // Don't await too long; log but ignore failures
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        await fetch(sheetsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            sessionId,
            name: cleanName,
            phone: cleanPhone,
            ip,
            userAgent: (req.headers['user-agent'] || '').substring(0, 200),
            timestamp: new Date().toISOString()
          }),
          signal: controller.signal
        }).catch(err => {
          console.warn('Sheets webhook failed (non-fatal):', err.message);
        });

        clearTimeout(timeoutId);
      } catch (e) {
        console.warn('Sheets call failed (non-fatal):', e.message);
      }
    }

    return res.status(200).json({ ok: true, sessionId });
  } catch (err) {
    console.error('Register handler error:', err);
    // Even on error, allow the user to continue - registration is not critical
    return res.status(200).json({ ok: true, sessionId: generateSessionId() });
  }
}
