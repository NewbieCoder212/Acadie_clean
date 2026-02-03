// Vercel Serverless Function for sending emails
// This keeps the Resend API key on the server side

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const DEFAULT_FROM_EMAIL = 'Acadia Clean <alerts@acadiacleaniq.ca>';

interface VercelRequest {
  method: string;
  body: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  };
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (data: Record<string, unknown>) => void;
  end: () => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Check API key
  if (!RESEND_API_KEY) {
    console.error('[send-email] RESEND_API_KEY not configured');
    res.status(500).json({ error: 'Email service not configured' });
    return;
  }

  try {
    const { to, subject, html, text } = req.body;

    console.log('[send-email] Received request:', { to, subject: subject?.substring(0, 50) });

    // Validate required fields
    if (!to || !subject || !html) {
      console.error('[send-email] Missing required fields');
      res.status(400).json({ error: 'Missing required fields: to, subject, html' });
      return;
    }

    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: DEFAULT_FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || '',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };
      console.error('[send-email] Resend API error:', response.status, errorData);
      res.status(response.status).json({
        error: `Failed to send email: ${errorData.message || response.statusText}`
      });
      return;
    }

    const data = await response.json() as { id: string };
    console.log('[send-email] Email sent successfully, ID:', data.id);
    res.status(200).json({ success: true, id: data.id });

  } catch (error) {
    console.error('[send-email] Exception:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
