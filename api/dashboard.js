// Vercel Serverless Function - Fetches raw lead rows for the private dashboard
// Receives: { password }
// Returns:  { ok: true, rows: [...] }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const dashboardPassword = process.env.DASHBOARD_PASSWORD;
  const sheetsUrl = process.env.SHEETS_WEBHOOK_URL;
  const sheetsReadKey = process.env.SHEETS_READ_KEY;

  if (!dashboardPassword || !sheetsUrl || !sheetsReadKey) {
    return res.status(500).json({ error: 'שגיאת הגדרה בשרת' });
  }

  const { password } = req.body || {};
  if (password !== dashboardPassword) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }

  try {
    const url = `${sheetsUrl}?key=${encodeURIComponent(sheetsReadKey)}`;
    const sheetsRes = await fetch(url);
    const data = await sheetsRes.json();
    if (!data.ok) {
      return res.status(500).json({ error: 'שגיאה בגישה לנתונים' });
    }
    return res.status(200).json({ ok: true, rows: data.rows });
  } catch (err) {
    console.error('Dashboard handler error:', err);
    return res.status(500).json({ error: 'שגיאה בטעינת הנתונים' });
  }
}
