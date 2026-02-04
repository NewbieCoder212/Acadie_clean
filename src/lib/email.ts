// Email service - uses Vercel serverless function to keep API key secure

// Base URL for email links and API calls
const BASE_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://app.acadiacleaniq.ca';

// Send email via the secure API endpoint
async function sendEmailViaAPI(params: { to: string; subject: string; html: string; text?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const apiUrl = `${BASE_URL}/api/send-email`;
    console.log('[Email] Sending to:', params.to);
    console.log('[Email] Subject:', params.subject);
    console.log('[Email] API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    console.log('[Email] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      console.log('[Email] Error response:', errorData);
      return {
        success: false,
        error: errorData.error || `Failed to send email (${response.status})`
      };
    }

    const successData = await response.json().catch(() => ({})) as { id?: string };
    console.log('[Email] Success! Email ID:', successData.id);
    return { success: true };
  } catch (error) {
    console.error('[Email] Exception:', error);
    return {
      success: false,
      error: 'Failed to connect to email service'
    };
  }
}

interface EmailParams {
  to: string | string[]; // Support single email or array of emails
  locationName: string;
  locationId: string;
  staffName: string;
  notes: string;
  uncheckedItems: string[];
  timestamp: Date;
}

/**
 * Generate HTML email template for attention required alerts
 */
function generateEmailHTML(params: EmailParams): string {
  const { locationName, locationId, staffName, notes, uncheckedItems, timestamp } = params;

  const formattedDate = timestamp.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const uncheckedItemsHTML = uncheckedItems
    .map(item => `<li style="color: #d97706; margin-bottom: 4px;">${item}</li>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attention Required - Acadia Clean</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">ACADIA CLEAN</h1>
              <div style="width: 60px; height: 4px; background-color: #d4af37; margin: 16px auto 0;"></div>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="background-color: #fef3c7; padding: 20px 32px; border-bottom: 2px solid #f59e0b;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 24px; margin-right: 12px;">⚠️</span>
                  </td>
                  <td style="vertical-align: middle; width: 100%;">
                    <h2 style="color: #92400e; margin: 0; font-size: 20px; font-weight: bold;">Attention Required</h2>
                    <p style="color: #a16207; margin: 4px 0 0; font-size: 14px;">Attention requise</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">

              <!-- Location Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f8fafc; border-radius: 12px; padding: 20px;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Location / Emplacement</p>
                    <h3 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: bold;">${locationName}</h3>
                    <p style="color: #64748b; font-size: 14px; margin: 4px 0 0;">ID: ${locationId}</p>
                  </td>
                </tr>
              </table>

              <!-- Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="50%" style="padding-right: 12px; vertical-align: top;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Staff / Personnel</p>
                    <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin: 0;">${staffName}</p>
                  </td>
                  <td width="50%" style="padding-left: 12px; vertical-align: top;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Date & Time</p>
                    <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin: 0;">${formattedDate}</p>
                    <p style="color: #64748b; font-size: 14px; margin: 2px 0 0;">${formattedTime}</p>
                  </td>
                </tr>
              </table>

              <!-- Unchecked Items -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px;">
                    <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 12px;">Unchecked Items / Éléments non cochés:</p>
                    <ul style="margin: 0; padding-left: 20px;">
                      ${uncheckedItemsHTML}
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Maintenance Notes -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px;">
                    <p style="color: #991b1b; font-size: 14px; font-weight: 600; margin: 0 0 8px;">Maintenance Notes / Notes d'entretien:</p>
                    <p style="color: #7f1d1d; font-size: 16px; margin: 0; line-height: 1.5;">${notes || 'No notes provided'}</p>
                  </td>
                </tr>
              </table>

              <!-- Action Button - Now informational only -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://app.acadiacleaniq.ca/manage-acadia9511" style="display: inline-block; background-color: #64748b; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px;">
                      View Manager Dashboard
                    </a>
                    <p style="color: #64748b; font-size: 12px; margin: 16px 0 0;">This issue will be automatically resolved when the next complete cleaning is logged</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">This is an automated alert from Acadia Clean</p>
              <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0;">NB Department of Health Compliance System</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for clients that don't support HTML
 */
function generateEmailText(params: EmailParams): string {
  const { locationName, locationId, staffName, notes, uncheckedItems, timestamp } = params;

  const formattedDate = timestamp.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `
ACADIA CLEAN - ATTENTION REQUIRED
=================================

Location: ${locationName}
Location ID: ${locationId}
Staff: ${staffName}
Date: ${formattedDate}
Time: ${formattedTime}

UNCHECKED ITEMS:
${uncheckedItems.map(item => `- ${item}`).join('\n')}

MAINTENANCE NOTES:
${notes || 'No notes provided'}

---
VIEW DASHBOARD:
https://app.acadiacleaniq.ca/manage-acadia9511

Note: This issue will be automatically resolved when the next complete cleaning is logged.

---
This is an automated alert from Acadia Clean
NB Department of Health Compliance System
  `.trim();
}

export interface SendAlertEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an attention required alert email via secure API
 * Supports sending to multiple recipients
 */
export async function sendAttentionRequiredEmail(params: EmailParams): Promise<SendAlertEmailResult> {
  try {
    const htmlContent = generateEmailHTML(params);
    const textContent = generateEmailText(params);

    // Normalize to array of emails
    const recipients = Array.isArray(params.to) ? params.to : [params.to];

    // Send to all recipients
    const results = await Promise.all(
      recipients.map(email =>
        sendEmailViaAPI({
          to: email,
          subject: `[Acadia Clean] Attention Required - ${params.locationName}`,
          html: htmlContent,
          text: textContent,
        })
      )
    );

    // Check if any email failed
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      return {
        success: false,
        error: failures[0].error || 'Failed to send some email alerts. The log was saved successfully.'
      };
    }

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: 'Failed to send email alert. The log was saved successfully.'
    };
  }
}

/**
 * Helper to get list of unchecked items from checklist
 */
export function getUncheckedItems(checklist: {
  handwashingStation: boolean;
  toiletPaper: boolean;
  bins: boolean;
  surfacesDisinfected: boolean;
  fixtures: boolean;
  waterTemperature: boolean;
  floors: boolean;
  ventilationLighting: boolean;
}): string[] {
  const items: string[] = [];

  if (!checklist.handwashingStation) {
    items.push('Handwashing Station / Poste de lavage des mains');
  }
  if (!checklist.toiletPaper) {
    items.push('Toilet Paper / Papier hygiénique');
  }
  if (!checklist.bins) {
    items.push('Bins / Poubelles');
  }
  if (!checklist.surfacesDisinfected) {
    items.push('Surfaces Disinfected / Surfaces désinfectées');
  }
  if (!checklist.fixtures) {
    items.push('Fixtures / Installations');
  }
  if (!checklist.waterTemperature) {
    items.push('Water Temperature / Température de l\'eau');
  }
  if (!checklist.floors) {
    items.push('Floors / Planchers');
  }
  if (!checklist.ventilationLighting) {
    items.push('Ventilation & Lighting / Ventilation et éclairage');
  }

  return items;
}

/**
 * Issue types for public reporting
 */
export const ISSUE_TYPES = [
  { value: 'out_of_supplies', label: 'Out of Supplies', labelFr: 'Rupture de stock' },
  { value: 'needs_cleaning', label: 'Needs Cleaning', labelFr: 'Nécessite un nettoyage' },
  { value: 'maintenance_required', label: 'Maintenance Required', labelFr: 'Entretien requis' },
  { value: 'safety_concern', label: 'Safety Concern', labelFr: 'Problème de sécurité' },
  { value: 'other', label: 'Other', labelFr: 'Autre' },
];

interface IssueReportParams {
  to: string | string[]; // Support single email or array of emails
  locationName: string;
  locationId: string;
  issueType: string;
  comment: string;
  timestamp: Date;
  issueId?: string; // Optional issue ID for deep linking
}

/**
 * Generate HTML email template for urgent issue reports
 */
function generateIssueReportHTML(params: IssueReportParams): string {
  const { locationName, locationId, issueType, comment, timestamp } = params;

  const issueLabel = ISSUE_TYPES.find(t => t.value === issueType)?.label || issueType;

  const formattedDate = timestamp.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Link directly to manager dashboard
  const managerUrl = 'https://app.acadiacleaniq.ca/manage-acadia9511';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URGENT: Issue Reported - Acadia Clean</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">ACADIA CLEAN</h1>
              <div style="width: 60px; height: 4px; background-color: #d4af37; margin: 16px auto 0;"></div>
            </td>
          </tr>

          <!-- Urgent Banner -->
          <tr>
            <td style="background-color: #fef2f2; padding: 20px 32px; border-bottom: 3px solid #ef4444;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 24px; margin-right: 12px;">🚨</span>
                  </td>
                  <td style="vertical-align: middle; width: 100%;">
                    <h2 style="color: #991b1b; margin: 0; font-size: 20px; font-weight: bold;">URGENT: Issue Reported</h2>
                    <p style="color: #b91c1c; margin: 4px 0 0; font-size: 14px;">Reported by a visitor/customer</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">

              <!-- Location Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f8fafc; border-radius: 12px; padding: 20px;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Location / Emplacement</p>
                    <h3 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: bold;">${locationName}</h3>
                    <p style="color: #64748b; font-size: 14px; margin: 4px 0 0;">ID: ${locationId}</p>
                  </td>
                </tr>
              </table>

              <!-- Issue Type -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 12px; padding: 20px;">
                    <p style="color: #991b1b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Issue Type / Type de problème</p>
                    <h3 style="color: #7f1d1d; margin: 0; font-size: 18px; font-weight: bold;">${issueLabel}</h3>
                  </td>
                </tr>
              </table>

              <!-- Comment -->
              ${comment ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px;">
                    <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px;">Comment / Commentaire:</p>
                    <p style="color: #78350f; font-size: 16px; margin: 0; line-height: 1.5;">${comment}</p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Time -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Reported At / Signalé à</p>
                    <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin: 0;">${formattedDate} at ${formattedTime}</p>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${managerUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 18px 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                      View Manager Dashboard
                    </a>
                    <p style="color: #64748b; font-size: 11px; margin: 12px 0 0;">Access your Manager Dashboard to resolve this issue</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">This is an automated urgent alert from Acadia Clean</p>
              <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0;">Reported by public visitor</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send an urgent issue report email via secure API
 * Supports sending to multiple recipients
 */
export async function sendIssueReportEmail(params: IssueReportParams): Promise<{ success: boolean; error?: string }> {
  try {
    const htmlContent = generateIssueReportHTML(params);
    const issueLabel = ISSUE_TYPES.find(t => t.value === params.issueType)?.label || params.issueType;

    // Normalize to array of emails
    const recipients = Array.isArray(params.to) ? params.to : [params.to];

    // Send to all recipients
    const results = await Promise.all(
      recipients.map(email =>
        sendEmailViaAPI({
          to: email,
          subject: `URGENT: Issue Reported at ${params.locationName} - ${issueLabel}`,
          html: htmlContent,
          text: `URGENT: Issue Reported at ${params.locationName}\n\nIssue Type: ${issueLabel}\nComment: ${params.comment || 'No comment provided'}\n\nPlease address this immediately.`,
        })
      )
    );

    // Check if any email failed
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      return {
        success: false,
        error: failures[0].error || 'Failed to send some reports'
      };
    }

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: 'Failed to send report. Please try again.'
    };
  }
}

// ============ TRIAL EXPIRY REMINDER EMAIL ============

// Admin email for trial expiry notifications
const ADMIN_EMAIL = 'jay@acadiacleaniq.ca';

interface TrialReminderParams {
  businessName: string;
  businessEmail: string;
  daysRemaining: number;
  trialEndsAt: Date;
}

/**
 * Generate HTML email template for trial expiry reminder
 */
function generateTrialReminderHTML(params: TrialReminderParams): string {
  const { businessName, daysRemaining, trialEndsAt } = params;

  const formattedEndDate = trialEndsAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trial Ending Soon - Acadia CleanIQ</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #059669; padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">ACADIA CleanIQ</h1>
              <div style="width: 60px; height: 4px; background-color: #d4af37; margin: 16px auto 0;"></div>
            </td>
          </tr>

          <!-- Reminder Banner -->
          <tr>
            <td style="background-color: #fef3c7; padding: 20px 32px; border-bottom: 2px solid #f59e0b;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 24px; margin-right: 12px;">⏰</span>
                  </td>
                  <td style="vertical-align: middle; width: 100%;">
                    <h2 style="color: #92400e; margin: 0; font-size: 20px; font-weight: bold;">Your Free Trial Ends Soon</h2>
                    <p style="color: #a16207; margin: 4px 0 0; font-size: 14px;">${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">

              <!-- Business Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #f8fafc; border-radius: 12px; padding: 20px;">
                    <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Business Account</p>
                    <h3 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: bold;">${businessName}</h3>
                  </td>
                </tr>
              </table>

              <!-- Trial End Date -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; text-align: center;">
                    <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px;">Trial Expires On</p>
                    <p style="color: #78350f; font-size: 24px; font-weight: bold; margin: 0;">${formattedEndDate}</p>
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                      Hi there,
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                      We hope you've been enjoying Acadia CleanIQ! Your 30-day free trial for <strong>${businessName}</strong> will end in <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.
                    </p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                      To continue using our washroom compliance tracking system without interruption, please contact us to activate your subscription.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Benefits Reminder -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px;">
                    <p style="color: #065f46; font-size: 14px; font-weight: 600; margin: 0 0 12px;">With your subscription, you'll continue to get:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #047857;">
                      <li style="margin-bottom: 8px;">Unlimited washroom locations</li>
                      <li style="margin-bottom: 8px;">Real-time cleaning compliance tracking</li>
                      <li style="margin-bottom: 8px;">Instant alert notifications</li>
                      <li style="margin-bottom: 8px;">PDF audit reports for inspectors</li>
                      <li style="margin-bottom: 0;">QR code scanning system</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Contact Info -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="mailto:jay@acadiacleaniq.ca?subject=Subscription%20Activation%20-%20${encodeURIComponent(businessName)}" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px;">
                      Contact Us to Subscribe
                    </a>
                    <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
                      Or email us directly at: <a href="mailto:jay@acadiacleaniq.ca" style="color: #059669;">jay@acadiacleaniq.ca</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">Questions? Reply to this email or contact jay@acadiacleaniq.ca</p>
              <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0;">Acadia CleanIQ - NB Department of Health Compliance System</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send trial expiry reminder email to admin (jay@acadiacleaniq.ca)
 * This is sent when a business has 7 days or less remaining in their trial
 */
export async function sendTrialExpiryReminderToAdmin(params: TrialReminderParams): Promise<{ success: boolean; error?: string }> {
  try {
    const htmlContent = generateTrialReminderHTML(params);

    // Send to admin
    const result = await sendEmailViaAPI({
      to: ADMIN_EMAIL,
      subject: `[Trial Ending] ${params.businessName} - ${params.daysRemaining} days remaining`,
      html: htmlContent,
      text: `Trial Expiry Reminder\n\nBusiness: ${params.businessName}\nEmail: ${params.businessEmail}\nDays Remaining: ${params.daysRemaining}\nTrial Ends: ${params.trialEndsAt.toLocaleDateString()}\n\nPlease contact this business about their subscription.`,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send reminder'
      };
    }

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: 'Failed to send trial expiry reminder.'
    };
  }
}

/**
 * Send trial expiry reminder email to the business owner
 */
export async function sendTrialExpiryReminderToBusiness(params: TrialReminderParams): Promise<{ success: boolean; error?: string }> {
  try {
    const htmlContent = generateTrialReminderHTML(params);

    // Send to business email
    const result = await sendEmailViaAPI({
      to: params.businessEmail,
      subject: `Your Acadia CleanIQ Trial Ends in ${params.daysRemaining} Day${params.daysRemaining === 1 ? '' : 's'}`,
      html: htmlContent,
      text: `Your Acadia CleanIQ trial for ${params.businessName} ends in ${params.daysRemaining} days on ${params.trialEndsAt.toLocaleDateString()}.\n\nTo continue using our service, please contact us at jay@acadiacleaniq.ca to activate your subscription.`,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send reminder'
      };
    }

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: 'Failed to send trial expiry reminder.'
    };
  }
}

