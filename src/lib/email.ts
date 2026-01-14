// Email service - uses Vercel serverless function to keep API key secure

// Base URL for email links and API calls
const BASE_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://acadiacleaniq.vercel.app';

// Send email via the secure API endpoint
async function sendEmailViaAPI(params: { to: string; subject: string; html: string; text?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${BASE_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      return {
        success: false,
        error: errorData.error || `Failed to send email (${response.status})`
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to connect to email service'
    };
  }
}

interface EmailParams {
  to: string;
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
                    <a href="${BASE_URL}/manager" style="display: inline-block; background-color: #64748b; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px;">
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
${BASE_URL}/manager

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
 */
export async function sendAttentionRequiredEmail(params: EmailParams): Promise<SendAlertEmailResult> {
  try {
    const htmlContent = generateEmailHTML(params);
    const textContent = generateEmailText(params);

    const result = await sendEmailViaAPI({
      to: params.to,
      subject: `[Acadia Clean] Attention Required - ${params.locationName}`,
      html: htmlContent,
      text: textContent,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send email alert. The log was saved successfully.'
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
  to: string;
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

  // Build the login URL - managers need to authenticate first
  // After login, they'll be redirected to the dashboard
  const loginUrl = `${BASE_URL}/login`;

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
                    <a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 18px 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);">
                      Login to View Issue
                    </a>
                    <p style="color: #64748b; font-size: 11px; margin: 12px 0 0;">Sign in to access your Manager Dashboard and resolve this issue</p>
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
 */
export async function sendIssueReportEmail(params: IssueReportParams): Promise<{ success: boolean; error?: string }> {
  try {
    const htmlContent = generateIssueReportHTML(params);
    const issueLabel = ISSUE_TYPES.find(t => t.value === params.issueType)?.label || params.issueType;

    const result = await sendEmailViaAPI({
      to: params.to,
      subject: `URGENT: Issue Reported at ${params.locationName} - ${issueLabel}`,
      html: htmlContent,
      text: `URGENT: Issue Reported at ${params.locationName}\n\nIssue Type: ${issueLabel}\nComment: ${params.comment || 'No comment provided'}\n\nPlease address this immediately.`,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send report'
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

