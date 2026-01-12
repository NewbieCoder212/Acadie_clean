// Vercel Serverless Function for sending emails
// This keeps the Resend API key on the server side

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const DEFAULT_FROM_EMAIL = 'Acadia Clean <onboarding@resend.dev>';

interface RequestBody {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export default async function handler(
  req: { method: string; body: RequestBody },
  res: { status: (code: number) => { json: (data: Record<string, unknown>) => void } }
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const { to, subject, html, text } = req.body;

    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
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
      return res.status(response.status).json({
        error: `Failed to send email: ${errorData.message || response.statusText}`
      });
    }

    const data = await response.json() as { id: string };
    return res.status(200).json({ success: true, id: data.id });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
