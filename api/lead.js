// Vercel Serverless Function - Send lead summary email via Resend
// Receives: { name, phone, history }
// Returns:  { ok: true }

const SHANI_EMAIL = process.env.SHANI_EMAIL || 'shanishlomo211@gmail.com';

// Ask Gemini to create a summary of the conversation
async function summarize(history, geminiKey) {
  const conversationText = history.map(m => {
    const role = m.role === 'user' ? 'משתמשת' : 'שני';
    return `${role}: ${m.content}`;
  }).join('\n\n');

  const prompt = `להלן שיחה בין שני שלמה (מטפלת ברפואה אינטגרטיבית) למשתמשת שהגיעה לצ׳אט. סכמי בעברית בשלושה חלקים קצרים:

1. **התסמין / הכאב** - מה היא סובלת ממנו, איפה בגוף, כמה זמן
2. **המשבר הרגשי שעלה** - מה עלה בשיחה, מה הרקע
3. **התובנה שהצענתי לה** - איזה משבר לפי השיטה מתאים

השיחה:
${conversationText}

סיכום מדויק (בלי הקדמות, ישר לעניין):`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 500 }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

function buildEmailHtml({ name, phone, summary, history }) {
  const conversation = history.map(m => {
    const isBot = m.role === 'assistant';
    const label = isBot ? 'שני' : 'משתמשת';
    const bg = isBot ? '#FFFFFF' : '#EFE7DA';
    const align = isBot ? 'right' : 'left';
    return `
      <div style="margin: 12px 0; padding: 12px 16px; background: ${bg}; border-radius: 12px; border-right: ${isBot ? '3px solid #C67D5B' : 'none'}; text-align: right;">
        <div style="font-size: 12px; color: #8B7B8B; margin-bottom: 4px;">${label}</div>
        <div style="font-size: 14px; color: #5C4033; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(m.content)}</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Assistant', -apple-system, sans-serif; background: #EFE7DA; padding: 20px; color: #2D2A26; direction: rtl; }
  .wrap { max-width: 640px; margin: 0 auto; background: #FAF7F2; border-radius: 16px; padding: 32px; box-shadow: 0 4px 16px rgba(92, 64, 51, 0.08); }
  h1 { color: #5C4033; font-size: 22px; margin-bottom: 8px; }
  .meta { color: #8B7B8B; font-size: 13px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px dashed #C9A8A0; }
  .card { background: white; border-radius: 12px; padding: 20px; margin: 16px 0; border-right: 4px solid #C67D5B; }
  .card h2 { color: #C67D5B; font-size: 15px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .card .value { color: #5C4033; font-size: 16px; line-height: 1.6; }
  .summary-box { background: #FFF8E8; border-right: 4px solid #C9A961; border-radius: 12px; padding: 20px; margin: 20px 0; }
  .summary-box h2 { color: #C9A961; font-size: 15px; margin-bottom: 10px; letter-spacing: 1px; }
  .conversation { margin-top: 24px; padding-top: 20px; border-top: 1px dashed #C9A8A0; }
  .conversation h2 { color: #5C4033; font-size: 16px; margin-bottom: 12px; }
  .footer { text-align: center; color: #8B7B8B; font-size: 12px; margin-top: 24px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>ליד חדש מהצ׳אטבוט</h1>
    <p class="meta">התקבל בתאריך ${new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>

    <div class="card">
      <h2>שם</h2>
      <div class="value">${escapeHtml(name)}</div>
    </div>

    <div class="card">
      <h2>טלפון</h2>
      <div class="value"><a href="tel:${escapeHtml(phone)}" style="color: #5C4033;">${escapeHtml(phone)}</a></div>
    </div>

    <div class="card">
      <h2>וואטסאפ ישיר</h2>
      <div class="value"><a href="https://wa.me/${phoneToWa(phone)}" style="color: #C67D5B; text-decoration: underline;">לחצי לפתיחת וואטסאפ</a></div>
    </div>

    ${summary ? `
    <div class="summary-box">
      <h2>סיכום השיחה</h2>
      <div style="color: #5C4033; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(summary)}</div>
    </div>
    ` : ''}

    <div class="conversation">
      <h2>השיחה המלאה</h2>
      ${conversation}
    </div>

    <p class="footer">נשלח אוטומטית מהצ׳אטבוט של shani-chat</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function phoneToWa(phone) {
  // Normalize Israeli phone to international format for wa.me
  let p = String(phone).replace(/[^\d]/g, '');
  if (p.startsWith('0')) p = '972' + p.slice(1);
  return p;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey = process.env.RESEND_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!resendKey) {
    return res.status(500).json({ error: 'Missing RESEND_API_KEY' });
  }

  try {
    const { name, phone, history } = req.body || {};

    if (!name || !phone || !Array.isArray(history)) {
      return res.status(400).json({ error: 'חסרים פרטים' });
    }

    // Sanitize phone
    const cleanPhone = String(phone).trim();
    if (cleanPhone.length < 8) {
      return res.status(400).json({ error: 'טלפון לא תקין' });
    }

    // Generate summary using Gemini (if key available)
    const summary = geminiKey ? await summarize(history, geminiKey) : null;

    // Build email HTML
    const html = buildEmailHtml({ name, phone: cleanPhone, summary, history });

    // Send email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Shani Chat <onboarding@resend.dev>',
        to: [SHANI_EMAIL],
        subject: `ליד חדש מהצ׳אטבוט: ${name}`,
        html,
        reply_to: SHANI_EMAIL
      })
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('Resend error:', emailRes.status, errText);
      return res.status(500).json({ error: 'שגיאה בשליחת המייל' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Lead handler error:', err);
    return res.status(500).json({ error: 'משהו השתבש' });
  }
}
