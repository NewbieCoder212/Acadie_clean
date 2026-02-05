// Vercel Serverless Function for checking overdue washrooms and sending alerts
// This should be called by a Vercel cron job every 30 minutes

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const DEFAULT_FROM_EMAIL = 'Acadia Clean <alerts@acadiacleaniq.ca>';
const APP_URL = 'https://app.acadiacleaniq.ca';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface VercelRequest {
  method: string;
  headers: {
    authorization?: string;
    'x-vercel-cron'?: string;
  };
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (data: Record<string, unknown>) => void;
  end: () => void;
}

interface Washroom {
  id: string;
  business_name: string;
  room_name: string;
  alert_email: string | null;
  alert_enabled: boolean;
  alert_threshold_hours: number;
  business_hours_start: string;
  business_hours_end: string;
  alert_days: string[];
  timezone: string;
  last_cleaned: string | null;
  last_alert_sent_at: string | null;
  is_active: boolean;
}

interface Business {
  name: string;
  global_alert_emails: string[] | null;
  use_global_alerts: boolean;
}

// Check if current time is within business hours
function isWithinBusinessHours(
  businessHoursStart: string,
  businessHoursEnd: string,
  timezone: string
): boolean {
  try {
    const now = new Date();

    // Get current time in the washroom's timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };

    const timeStr = now.toLocaleTimeString('en-US', options);
    const [currentHour, currentMinute] = timeStr.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMin] = businessHoursStart.split(':').map(Number);
    const [endHour, endMin] = businessHoursEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch (error) {
    console.error('[check-overdue] Error checking business hours:', error);
    return false;
  }
}

// Check if today is an alert day
function isAlertDay(alertDays: string[], timezone: string): boolean {
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: 'long',
    };

    const dayName = now.toLocaleDateString('en-US', options).toLowerCase();
    return alertDays.includes(dayName);
  } catch (error) {
    console.error('[check-overdue] Error checking alert day:', error);
    return false;
  }
}

// Check if washroom is overdue for cleaning
function isOverdue(lastCleaned: string | null, thresholdHours: number): boolean {
  if (!lastCleaned) return true; // Never cleaned = overdue

  const lastCleanedTime = new Date(lastCleaned).getTime();
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  const now = Date.now();

  return (now - lastCleanedTime) > thresholdMs;
}

// Check if we should send an alert (not sent in last 2 hours)
function shouldSendAlert(lastAlertSentAt: string | null): boolean {
  if (!lastAlertSentAt) return true;

  const lastSentTime = new Date(lastAlertSentAt).getTime();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const now = Date.now();

  return (now - lastSentTime) > twoHoursMs;
}

// Get all alert recipients for a washroom
async function getAlertRecipients(washroom: Washroom): Promise<string[]> {
  const emails: string[] = [];

  // Add location-specific email
  if (washroom.alert_email) {
    emails.push(washroom.alert_email.toLowerCase());
  }

  // Get business global alert settings
  if (washroom.business_name) {
    const { data: business } = await supabase
      .from('businesses')
      .select('global_alert_emails, use_global_alerts')
      .eq('name', washroom.business_name)
      .single();

    if (business && business.use_global_alerts && business.global_alert_emails) {
      for (const email of business.global_alert_emails) {
        const normalizedEmail = email.toLowerCase();
        if (!emails.includes(normalizedEmail)) {
          emails.push(normalizedEmail);
        }
      }
    }
  }

  return emails;
}

// Generate overdue alert email HTML
function generateOverdueEmailHtml(
  businessName: string,
  washroomName: string,
  washroomId: string,
  lastCleaned: string | null,
  thresholdHours: number,
  timezone: string = 'America/Moncton'
): string {
  const loginUrl = `${APP_URL}/manage-acadia9511`;
  const now = new Date();

  // Format current time in the washroom's timezone
  const formattedDate = now.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Format last cleaned time in the washroom's timezone
  const lastCleanedStr = lastCleaned
    ? new Date(lastCleaned).toLocaleString('en-US', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Never';

  const hoursOverdue = lastCleaned
    ? Math.round((Date.now() - new Date(lastCleaned).getTime()) / (1000 * 60 * 60))
    : thresholdHours;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cleaning Overdue Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">ACADIA CLEAN</h1>
              <div style="width: 60px; height: 4px; background-color: #d4af37; margin: 16px auto 0;"></div>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="background-color: #fef3c7; padding: 20px 32px; border-bottom: 3px solid #f59e0b;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 24px; margin-right: 12px;">⚠️</span>
                  </td>
                  <td style="vertical-align: middle; width: 100%;">
                    <h2 style="color: #92400e; margin: 0; font-size: 20px; font-weight: bold;">Cleaning Overdue</h2>
                    <p style="color: #b45309; margin: 4px 0 0; font-size: 14px;">Nettoyage en retard</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">

              <!-- Business & Location Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f8fafc; border-radius: 12px; padding: 20px;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Business / Entreprise</p>
                    <h3 style="color: #0f172a; margin: 0 0 12px; font-size: 18px; font-weight: bold;">${businessName}</h3>
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Location / Emplacement</p>
                    <h3 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: bold;">${washroomName}</h3>
                  </td>
                </tr>
              </table>

              <!-- Overdue Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fef3c7; border: 2px solid #fcd34d; border-radius: 12px; padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <p style="color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Last Cleaned / Dernier nettoyage</p>
                          <p style="color: #78350f; font-size: 16px; font-weight: bold; margin: 0;">${lastCleanedStr}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Hours Overdue / Heures de retard</p>
                          <p style="color: #dc2626; font-size: 24px; font-weight: bold; margin: 0;">${hoursOverdue}+ hours</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Alert Time -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Alert Sent / Alerte envoyée</p>
                    <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin: 0;">${formattedDate} at ${formattedTime}</p>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 18px 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">
                      Login to Dashboard
                    </a>
                    <p style="color: #64748b; font-size: 11px; margin: 12px 0 0;">Sign in to mark this location as cleaned</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">This is an automated alert from Acadia Clean</p>
              <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0;">Threshold: ${thresholdHours} hours</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Send email via Resend
async function sendEmail(to: string[], subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: DEFAULT_FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[check-overdue] Email send failed:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[check-overdue] Email send error:', error);
    return false;
  }
}

// Update last_alert_sent_at timestamp
async function updateLastAlertSent(washroomId: string): Promise<void> {
  try {
    await supabase
      .from('washrooms')
      .update({ last_alert_sent_at: new Date().toISOString() })
      .eq('id', washroomId);
  } catch (error) {
    console.error('[check-overdue] Failed to update last_alert_sent_at:', error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verify this is a legitimate cron request
  // Vercel crons send a special header we can verify
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const vercelCronHeader = req.headers['x-vercel-cron'];

  // Allow request if:
  // 1. It's from Vercel's cron scheduler (x-vercel-cron header present)
  // 2. OR it has a valid Bearer token (for manual testing)
  const isVercelCron = vercelCronHeader === '1';
  const hasValidToken = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !hasValidToken) {
    console.error('[check-overdue] Unauthorized request - no valid cron header or token');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  console.log(`[check-overdue] Auth method: ${isVercelCron ? 'Vercel Cron' : 'Bearer Token'}`);

  // Helper function to add delay between API calls (for rate limiting)
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Check required env vars
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[check-overdue] Supabase not configured');
    res.status(500).json({ error: 'Database not configured' });
    return;
  }

  if (!RESEND_API_KEY) {
    console.error('[check-overdue] Resend API key not configured');
    res.status(500).json({ error: 'Email service not configured' });
    return;
  }

  console.log('[check-overdue] Starting overdue check...');

  try {
    // Calculate the threshold time for rate limiting (2 hours ago)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // OPTIMIZED QUERY: Filter at database level to reduce data transfer
    // - Only active washrooms with alerts enabled
    // - Exclude washrooms that received alerts in the last 2 hours
    // - Only fetch necessary columns
    const { data: washrooms, error } = await supabase
      .from('washrooms')
      .select(`
        id,
        business_name,
        room_name,
        alert_email,
        alert_enabled,
        alert_threshold_hours,
        business_hours_start,
        business_hours_end,
        alert_days,
        timezone,
        last_cleaned,
        last_alert_sent_at,
        is_active
      `)
      .eq('is_active', true)
      .eq('alert_enabled', true)
      .or(`last_alert_sent_at.is.null,last_alert_sent_at.lt.${twoHoursAgo}`);

    if (error) {
      console.error('[check-overdue] Database error:', error);
      res.status(500).json({ error: 'Database error' });
      return;
    }

    if (!washrooms || washrooms.length === 0) {
      console.log('[check-overdue] No washrooms to check (all recently alerted or none enabled)');
      res.status(200).json({ message: 'No washrooms to check', checked: 0, alerts: 0 });
      return;
    }

    console.log(`[check-overdue] Checking ${washrooms.length} eligible washrooms...`);

    let alertsSent = 0;
    const results: Array<{ washroom: string; status: string }> = [];

    for (const washroom of washrooms as Washroom[]) {
      const washroomName = `${washroom.business_name} - ${washroom.room_name}`;

      // Check if today is an alert day
      if (!isAlertDay(washroom.alert_days || [], washroom.timezone || 'America/Moncton')) {
        results.push({ washroom: washroomName, status: 'not_alert_day' });
        continue;
      }

      // Check if within business hours
      if (!isWithinBusinessHours(
        washroom.business_hours_start || '08:00',
        washroom.business_hours_end || '17:00',
        washroom.timezone || 'America/Moncton'
      )) {
        results.push({ washroom: washroomName, status: 'outside_business_hours' });
        continue;
      }

      // Check if overdue
      if (!isOverdue(washroom.last_cleaned, washroom.alert_threshold_hours || 8)) {
        results.push({ washroom: washroomName, status: 'not_overdue' });
        continue;
      }

      // Check if we should send an alert (rate limit)
      if (!shouldSendAlert(washroom.last_alert_sent_at)) {
        results.push({ washroom: washroomName, status: 'alert_recently_sent' });
        continue;
      }

      // Get recipients
      const recipients = await getAlertRecipients(washroom);

      if (recipients.length === 0) {
        results.push({ washroom: washroomName, status: 'no_recipients' });
        continue;
      }

      // Generate and send email
      const html = generateOverdueEmailHtml(
        washroom.business_name,
        washroom.room_name,
        washroom.id,
        washroom.last_cleaned,
        washroom.alert_threshold_hours || 8,
        washroom.timezone || 'America/Moncton'
      );

      const subject = `⚠️ Cleaning Overdue: ${washroom.room_name} - ${washroom.business_name}`;

      const sent = await sendEmail(recipients, subject, html);

      if (sent) {
        await updateLastAlertSent(washroom.id);
        alertsSent++;
        results.push({ washroom: washroomName, status: 'alert_sent' });
        console.log(`[check-overdue] Alert sent for: ${washroomName} to ${recipients.join(', ')}`);
      } else {
        results.push({ washroom: washroomName, status: 'send_failed' });
      }

      // Rate limit: wait 600ms between emails to stay under Resend's 2 req/sec limit
      await delay(600);
    }

    console.log(`[check-overdue] Complete. Checked: ${washrooms.length}, Alerts sent: ${alertsSent}`);

    res.status(200).json({
      message: 'Overdue check complete',
      checked: washrooms.length,
      alerts: alertsSent,
      results,
    });

  } catch (error) {
    console.error('[check-overdue] Exception:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
