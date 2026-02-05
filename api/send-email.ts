// Vercel Serverless Function for sending emails
// This keeps the Resend API key on the server side
// SECURITY: Protected by API_SECRET - only internal calls allowed

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const API_SECRET = process.env.API_SECRET ?? '';
const DEFAULT_FROM_EMAIL = 'Acadia Clean <alerts@acadiacleaniq.ca>';

// Allowed origins for CORS (production only)
const ALLOWED_ORIGINS = [
  'https://app.acadiacleaniq.ca',
  'https://acadiacleaniq.vercel.app',
];

interface VercelRequest {
  method: string;
  headers: {
    origin?: string;
    'x-api-secret'?: string;
    authorization?: string;
  };
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
  const origin = req.headers.origin || '';

  // Set CORS headers - only allow our domains
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // Allow localhost in development
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // If origin not allowed, don't set Access-Control-Allow-Origin (browser will block)

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Secret, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

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

  // SECURITY: Verify API secret
  // Accept either X-API-Secret header or Authorization: Bearer <secret>
  const providedSecret = req.headers['x-api-secret'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : '');

  if (!API_SECRET) {
    console.error('[send-email] API_SECRET not configured on server');
    res.status(500).json({ error: 'Email service misconfigured' });
    return;
  }

  if (providedSecret !== API_SECRET) {
    console.error('[send-email] Unauthorized request - invalid or missing API secret');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Check Resend API key
  if (!RESEND_API_KEY) {
    console.error('[send-email] RESEND_API_KEY not configured');
    res.status(500).json({ error: 'Email service not configured' });
    return;
  }

  try {
    const { to, subject, html, text } = req.body;

    // Validate required fields
    if (!to || !subject || !html) {
      res.status(400).json({ error: 'Missing required fields: to, subject, html' });
      return;
    }

    // Validate email recipients
    const recipients = Array.isArray(to) ? to : [to];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of recipients) {
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: `Invalid email address: ${email}` });
        return;
      }
    }

    // Rate limit check: max 10 recipients per request
    if (recipients.length > 10) {
      res.status(400).json({ error: 'Too many recipients. Maximum 10 per request.' });
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
        to: recipients,
        subject,
        html,
        text: text || '',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };
      console.error('[send-email] Resend API error:', response.status);
      res.status(response.status).json({
        error: `Failed to send email: ${errorData.message || response.statusText}`
      });
      return;
    }

    const data = await response.json() as { id: string };
    res.status(200).json({ success: true, id: data.id });

  } catch (error) {
    console.error('[send-email] Exception:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
