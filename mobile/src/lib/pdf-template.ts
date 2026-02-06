/**
 * Unified PDF Template for Acadia CleanIQ Reports
 * Provides consistent styling across Audit Reports and History Reports
 */

// Acadia CleanIQ Logo as SVG (embedded directly for PDF compatibility)
const ACADIA_LOGO_SVG = `
<svg width="120" height="40" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
  <!-- QR-style icon -->
  <rect x="0" y="0" width="14" height="14" rx="2" fill="#065f46"/>
  <rect x="2" y="2" width="10" height="10" rx="1" fill="#fff"/>
  <rect x="4" y="4" width="6" height="6" rx="0.5" fill="#065f46"/>
  <rect x="0" y="26" width="14" height="14" rx="2" fill="#065f46"/>
  <rect x="2" y="28" width="10" height="10" rx="1" fill="#fff"/>
  <rect x="4" y="30" width="6" height="6" rx="0.5" fill="#065f46"/>
  <rect x="26" y="0" width="14" height="14" rx="2" fill="#065f46"/>
  <rect x="28" y="2" width="10" height="10" rx="1" fill="#fff"/>
  <rect x="30" y="4" width="6" height="6" rx="0.5" fill="#065f46"/>
  <!-- Center water drop -->
  <path d="M20 8 C20 8 13 18 13 24 C13 29 16 32 20 32 C24 32 27 29 27 24 C27 18 20 8 20 8 Z" fill="#059669"/>
  <path d="M16 23 L18 26 L24 19" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <!-- Text -->
  <text x="46" y="18" font-family="Montserrat, Inter, -apple-system, sans-serif" font-size="14" font-weight="800" fill="#065f46">Acadia</text>
  <text x="46" y="34" font-family="Montserrat, Inter, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#059669">CleanIQ</text>
</svg>`;

// Client Logo Placeholder
const CLIENT_LOGO_PLACEHOLDER = `
<div style="width: 120px; height: 40px; border: 2px dashed #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
  <span style="font-size: 10px; color: #9ca3af; font-family: Montserrat, Inter, sans-serif;">Client Logo</span>
</div>`;

export interface PDFTemplateConfig {
  documentTitle: string;
  documentType: 'audit' | 'history' | 'scan-history' | 'incident-reports';
  businessName: string;
  location?: string; // e.g., "Main Street Branch - All Units"
  dateRange: {
    start: Date;
    end: Date;
  };
  tableHeaders: string[];
  tableHeaderAbbreviations?: string[]; // Short codes like HS, TP, BN
  tableRows: string;
  showLegend?: boolean;
  legendItems?: Array<{ code: string; description: string }>;
}

const formatDateRange = (start: Date, end: Date): string => {
  const formatDate = (d: Date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };
  return `${formatDate(start)} – ${formatDate(end)}`;
};

const getDocumentTitleLabel = (type: PDFTemplateConfig['documentType']): string => {
  switch (type) {
    case 'audit':
      return 'Official Compliance Audit';
    case 'history':
      return 'Cleaning History Report';
    case 'scan-history':
      return 'QR Scan History Report';
    case 'incident-reports':
      return 'Incident Reports / Rapports d\'incidents';
    default:
      return 'Report';
  }
};

// Default legend items for cleaning reports (matches database structure)
const DEFAULT_LEGEND_ITEMS = [
  { code: 'SP', description: 'Supplies (Soap, Paper) / Fournitures (savon, papier)' },
  { code: 'BN', description: 'Bins / Poubelles' },
  { code: 'SD', description: 'Surfaces Disinfected / Surfaces désinfectées' },
  { code: 'FX', description: 'Fixtures & Systems / Accessoires et systèmes' },
  { code: 'FL', description: 'Floors / Planchers' },
];

// Status badge helper
export const getStatusBadge = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'complete':
    case 'ok':
    case 'clean':
      return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 9px; background-color: #dcfce7; color: #166534;">Complete</span>`;
    case 'incomplete':
    case 'partial':
      return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 9px; background-color: #fee2e2; color: #dc2626;">Incomplete</span>`;
    case 'attention':
    case 'att':
    case 'attention required':
      return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 9px; background-color: #fef3c7; color: #92400e;">Attention Required</span>`;
    default:
      return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 9px; background-color: #f1f5f9; color: #64748b;">${status}</span>`;
  }
};

// Checkmark helper
export const getCheckIcon = (checked: boolean): string => {
  return checked
    ? '<span style="color: #059669; font-weight: bold; font-size: 14px;">✓</span>'
    : '<span style="color: #dc2626; font-weight: bold; font-size: 14px;">✗</span>';
};

// Truncate helper
export const truncateText = (text: string, maxLength: number): string => {
  if (!text) return '-';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

export const generatePDFHTML = (config: PDFTemplateConfig): string => {
  const {
    documentTitle,
    documentType,
    businessName,
    location,
    dateRange,
    tableHeaders,
    tableRows,
    showLegend = true,
    legendItems = DEFAULT_LEGEND_ITEMS,
  } = config;

  const dateRangeStr = formatDateRange(dateRange.start, dateRange.end);
  const titleLabel = documentTitle || getDocumentTitleLabel(documentType);
  const generatedDate = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Generate table header cells
  const headerCells = tableHeaders.map((header, index) => {
    // First two columns (Date/Time and Staff/Location) are left-aligned
    const isLeftAligned = index < 2;
    return `<th style="text-align: ${isLeftAligned ? 'left' : 'center'};">${header}</th>`;
  }).join('');

  // Generate legend HTML
  const legendHTML = showLegend && legendItems.length > 0 ? `
    <div class="legend">
      <div class="legend-title">Legend / Légende:</div>
      <div class="legend-grid">
        ${legendItems.map(item => `<span><strong>${item.code}</strong> = ${item.description}</span>`).join('')}
        <span style="margin-left: 12px;"><span style="color: #059669; font-size: 12px;">✓</span> = Complete / Complété</span>
        <span><span style="color: #dc2626; font-size: 12px;">✗</span> = Incomplete / Incomplet</span>
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${titleLabel} - ${businessName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: letter landscape;
            margin: 10mm;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
            color: #1e293b;
            padding: 16px 20px;
            font-size: 11px;
            background: white;
          }

          /* ========== HEADER SECTION ========== */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #065f46;
          }
          .header-logo-left {
            display: flex;
            align-items: center;
          }
          .header-logo-right {
            display: flex;
            align-items: center;
          }
          .header-info {
            flex: 1;
            text-align: center;
            padding: 0 20px;
          }
          .header-info .doc-title {
            font-size: 16px;
            font-weight: 800;
            color: #065f46;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
          }
          .header-info .location {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 2px;
          }
          .header-info .date-range {
            font-size: 11px;
            font-weight: 500;
            color: #6b7280;
          }

          /* ========== TABLE SECTION ========== */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            border: 1px solid #d1d5db;
          }
          thead tr {
            background-color: #065f46;
          }
          th {
            padding: 10px 6px;
            font-size: 10px;
            font-weight: 700;
            color: #ffffff;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          tbody tr:nth-child(odd) {
            background-color: #ecfdf5;
          }
          tbody tr:nth-child(even) {
            background-color: #ffffff;
          }
          td {
            padding: 8px 6px;
            font-size: 10px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
          }
          td:not(:first-child):not(:nth-child(2)) {
            text-align: center;
          }

          /* ========== FOOTER SECTION ========== */
          .page-footer {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
          }
          .legend {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 12px;
            margin-bottom: 12px;
          }
          .legend-title {
            font-weight: 700;
            font-size: 9px;
            color: #374151;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .legend-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            font-size: 8px;
            color: #4b5563;
          }
          .footer-bottom {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            color: #6b7280;
          }
          .footer-branding {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .footer-branding svg {
            width: 24px;
            height: 24px;
          }
          .footer-generated {
            text-align: right;
          }
        </style>
      </head>
      <body>
        <!-- HEADER -->
        <div class="header">
          <div class="header-logo-left">
            ${ACADIA_LOGO_SVG}
          </div>
          <div class="header-info">
            <div class="doc-title">${titleLabel}</div>
            <div class="location">${location || businessName}</div>
            <div class="date-range">${dateRangeStr}</div>
          </div>
          <div class="header-logo-right">
            ${CLIENT_LOGO_PLACEHOLDER}
          </div>
        </div>

        <!-- DATA TABLE -->
        <table>
          <thead>
            <tr>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <!-- FOOTER -->
        <div class="page-footer">
          ${legendHTML}
          <div class="footer-bottom">
            <div class="footer-branding">
              <svg width="24" height="24" viewBox="0 0 100 100">
                <rect x="5" y="5" width="25" height="25" rx="4" fill="#065f46"/>
                <rect x="9" y="9" width="17" height="17" rx="2" fill="#fff"/>
                <rect x="13" y="13" width="9" height="9" rx="1" fill="#065f46"/>
                <rect x="70" y="5" width="25" height="25" rx="4" fill="#065f46"/>
                <rect x="74" y="9" width="17" height="17" rx="2" fill="#fff"/>
                <rect x="78" y="13" width="9" height="9" rx="1" fill="#065f46"/>
                <rect x="5" y="70" width="25" height="25" rx="4" fill="#065f46"/>
                <rect x="9" y="74" width="17" height="17" rx="2" fill="#fff"/>
                <rect x="13" y="78" width="9" height="9" rx="1" fill="#065f46"/>
                <path d="M50 28 C50 28 35 45 35 58 C35 68 41 75 50 75 C59 75 65 68 65 58 C65 45 50 28 50 28 Z" fill="#059669"/>
                <path d="M42 55 L47 62 L58 48" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
              <span style="font-weight: 600; color: #065f46;">Powered by Acadia CleanIQ</span>
            </div>
            <div class="footer-generated">
              Generated on ${generatedDate}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Opens HTML content for PDF viewing/printing on web platforms
 * Creates a completely standalone page that prints correctly on iOS Safari
 */
export const openPDFInNewWindow = (html: string): boolean => {
  try {
    // Check if we're in a web environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    // Extract styles and body content from the original HTML
    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const extractedStyles = styleMatches.join('\n');
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';

    // Create a completely standalone HTML document optimized for iOS printing
    const standaloneHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>PDF Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* Base reset */
    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: white;
      font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Toolbar styles */
    .print-toolbar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #065f46 0%, #059669 100%);
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .print-toolbar-title {
      color: white;
      font-size: 16px;
      font-weight: 600;
    }
    .print-toolbar-buttons {
      display: flex;
      gap: 12px;
    }
    .print-toolbar button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-print-action {
      background: white;
      color: #065f46;
    }
    .btn-close-action {
      background: rgba(255,255,255,0.15);
      color: white;
      border: 1px solid rgba(255,255,255,0.3) !important;
    }

    /* PDF content wrapper */
    .pdf-print-content {
      background: white;
      min-height: 100vh;
    }

    /* Force colors to print */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    /* CRITICAL: Print-specific styles */
    @media print {
      /* Hide toolbar completely */
      .print-toolbar {
        display: none !important;
        visibility: hidden !important;
        position: absolute !important;
        left: -9999px !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
      }

      /* Reset page */
      html, body {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: white !important;
      }

      .pdf-print-content {
        position: static !important;
        width: 100% !important;
        min-height: auto !important;
        padding: 10mm !important;
        margin: 0 !important;
      }

      /* Table pagination */
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
    }

    @page {
      size: letter landscape;
      margin: 10mm;
    }
  </style>
  ${extractedStyles}
</head>
<body>
  <div class="print-toolbar">
    <span class="print-toolbar-title">PDF Report - Tap Print to Save</span>
    <div class="print-toolbar-buttons">
      <button class="btn-print-action" onclick="window.print()">Print / Save PDF</button>
      <button class="btn-close-action" onclick="closePDF()">Close</button>
    </div>
  </div>
  <div class="pdf-print-content">
    ${bodyContent}
  </div>
  <script>
    // Store the referrer URL for proper navigation back
    var previousUrl = document.referrer || null;

    function closePDF() {
      // Try to close window if opened as popup
      if (window.opener) {
        window.close();
        return;
      }

      // If we have a referrer, navigate back to it
      if (previousUrl && previousUrl.length > 0) {
        window.location.href = previousUrl;
        return;
      }

      // Try history.back() but with a fallback
      if (window.history.length > 1) {
        history.back();
        // If we're still on the same page after 100ms, redirect to manager
        setTimeout(function() {
          // Check if we're still on the blob URL (back didn't work)
          if (window.location.href.startsWith('blob:')) {
            window.location.href = '/manager';
          }
        }, 100);
      } else {
        // No history, redirect to manager dashboard
        window.location.href = '/manager';
      }
    }
  </script>
</body>
</html>`;

    // Create blob URL for the standalone document
    const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    // Try opening in new window/tab first
    const pdfWindow = window.open(blobUrl, '_blank', 'noopener');

    if (pdfWindow) {
      // Successfully opened - clean up blob after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
      return true;
    }

    // Popup was blocked - navigate in same window with user confirmation
    const confirmed = window.confirm(
      'Popup was blocked by your browser.\n\nClick OK to open the PDF in this tab.\nUse the back button or Close button to return.'
    );

    if (confirmed) {
      window.location.href = blobUrl;
      return true;
    }

    // User cancelled
    URL.revokeObjectURL(blobUrl);
    return false;
  } catch (error) {
    console.error('[PDF] Error creating print view:', error);
    return false;
  }
};

// Web toolbar for viewing PDFs in browser
export const addWebToolbar = (html: string, title: string): string => {
  return html.replace('</head>', `
    <style>
      .pdf-toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #065f46 0%, #059669 100%);
        padding: 12px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        font-family: 'Montserrat', -apple-system, sans-serif;
      }
      .pdf-toolbar-title {
        color: white;
        font-size: 14px;
        font-weight: 600;
      }
      .pdf-toolbar-buttons {
        display: flex;
        gap: 10px;
      }
      .pdf-toolbar button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
        font-family: 'Montserrat', -apple-system, sans-serif;
      }
      .pdf-toolbar button:hover {
        opacity: 0.9;
      }
      .btn-print {
        background: white;
        color: #065f46;
      }
      .btn-close {
        background: #dc2626;
        color: white;
      }
      @media print {
        .pdf-toolbar { display: none !important; }
        body { padding-top: 16px !important; }
      }
    </style>
  </head>`).replace('<body>', `<body style="padding-top: 60px;">
    <div class="pdf-toolbar">
      <span class="pdf-toolbar-title">${title}</span>
      <div class="pdf-toolbar-buttons">
        <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
        <button class="btn-close" onclick="window.close()">Close / Fermer</button>
      </div>
    </div>`);
};

// Legend items for incident reports
const INCIDENT_LEGEND_ITEMS = [
  { code: 'Open', description: 'Awaiting resolution / En attente de résolution' },
  { code: 'Resolved', description: 'Issue addressed / Problème résolu' },
];

// Incident report row interface
export interface IncidentReportRow {
  id: string;
  location_name: string;
  issue_type: string;
  description: string;
  status: 'open' | 'resolved';
  created_at: string;
  resolved_at?: string | null;
  resolution_action?: string | null;
  resolution_action_label?: string | null;
  resolved_by?: string | null;
}

// Calculate average resolution time in hours
const calculateAverageResolutionTime = (issues: IncidentReportRow[]): string => {
  const resolvedIssues = issues.filter(i => i.status === 'resolved' && i.resolved_at);
  if (resolvedIssues.length === 0) return 'N/A';

  let totalMinutes = 0;
  resolvedIssues.forEach(issue => {
    const createdAt = new Date(issue.created_at).getTime();
    const resolvedAt = new Date(issue.resolved_at!).getTime();
    totalMinutes += (resolvedAt - createdAt) / (1000 * 60);
  });

  const avgMinutes = totalMinutes / resolvedIssues.length;

  if (avgMinutes < 60) {
    return `${Math.round(avgMinutes)} min`;
  } else if (avgMinutes < 1440) {
    const hours = Math.round(avgMinutes / 60 * 10) / 10;
    return `${hours} hr${hours !== 1 ? 's' : ''}`;
  } else {
    const days = Math.round(avgMinutes / 1440 * 10) / 10;
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
};

// Generate incident reports PDF HTML
export const generateIncidentReportsPDF = (
  businessName: string,
  issues: IncidentReportRow[],
  dateRange: { start: Date; end: Date },
  includeOpenIssues: boolean = true
): string => {
  // Filter by date range and optionally by status
  const filteredIssues = issues.filter(issue => {
    const createdAt = new Date(issue.created_at);
    const inDateRange = createdAt >= dateRange.start && createdAt <= dateRange.end;
    if (!inDateRange) return false;
    if (!includeOpenIssues && issue.status === 'open') return false;
    return true;
  });

  // Sort by date (newest first)
  filteredIssues.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Calculate metrics
  const totalIssues = filteredIssues.length;
  const resolvedIssues = filteredIssues.filter(i => i.status === 'resolved').length;
  const openIssues = filteredIssues.filter(i => i.status === 'open').length;
  const avgResolutionTime = calculateAverageResolutionTime(filteredIssues);

  // Format date/time for display
  const formatDateTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Format time elapsed between two dates
  const formatTimeElapsed = (startStr: string, endStr: string | null | undefined): string => {
    if (!endStr) return '-';
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const minutes = Math.round((end - start) / (1000 * 60));

    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) {
      const hours = Math.round(minutes / 60 * 10) / 10;
      return `${hours} hr${hours !== 1 ? 's' : ''}`;
    }
    const days = Math.round(minutes / 1440 * 10) / 10;
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  // Get status badge HTML
  const getIssueStatusBadge = (status: 'open' | 'resolved'): string => {
    if (status === 'resolved') {
      return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 9px; background-color: #dcfce7; color: #166534;">Resolved</span>`;
    }
    return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 9px; background-color: #fef3c7; color: #92400e;">Open</span>`;
  };

  // Get resolution action badge HTML
  const getResolutionActionBadge = (issue: IncidentReportRow): string => {
    if (issue.status === 'open') return '-';
    if (!issue.resolution_action_label) return '<span style="color: #6b7280; font-size: 9px;">-</span>';
    return `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 8px; background-color: #f1f5f9; color: #475569;">${issue.resolution_action_label}</span>`;
  };

  // Generate table rows
  const tableRows = filteredIssues.map(issue => `
    <tr>
      <td style="white-space: nowrap;">${formatDateTime(issue.created_at)}</td>
      <td>${truncateText(issue.location_name, 20)}</td>
      <td>${issue.issue_type}</td>
      <td>${truncateText(issue.description || '-', 30)}</td>
      <td style="text-align: center;">${getIssueStatusBadge(issue.status)}</td>
      <td style="text-align: center;">${getResolutionActionBadge(issue)}</td>
      <td style="text-align: center;">${issue.resolved_by ? truncateText(issue.resolved_by, 15) : '-'}</td>
      <td style="text-align: center;">${formatTimeElapsed(issue.created_at, issue.resolved_at)}</td>
    </tr>
  `).join('');

  // Generate the PDF HTML using the template
  const config: PDFTemplateConfig = {
    documentTitle: 'Incident Reports / Rapports d\'incidents',
    documentType: 'incident-reports',
    businessName,
    location: `${businessName} - All Locations / Tous les emplacements`,
    dateRange,
    tableHeaders: [
      'Reported / Signalé',
      'Location',
      'Type',
      'Description',
      'Status',
      'Action',
      'Resolved By',
      'Time',
    ],
    tableRows: tableRows || `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #6b7280;">No incidents reported in this period / Aucun incident signalé pour cette période</td></tr>`,
    showLegend: false, // We'll add custom summary instead
  };

  // Generate base HTML
  let html = generatePDFHTML(config);

  // Add summary metrics section before the table
  const summaryHTML = `
    <div style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 120px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: 800; color: #166534;">${totalIssues}</div>
        <div style="font-size: 10px; color: #15803d; font-weight: 600;">Total Issues / Total</div>
      </div>
      <div style="flex: 1; min-width: 120px; background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: 800; color: #166534;">${resolvedIssues}</div>
        <div style="font-size: 10px; color: #15803d; font-weight: 600;">Resolved / Résolus</div>
      </div>
      ${includeOpenIssues ? `
      <div style="flex: 1; min-width: 120px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: 800; color: #92400e;">${openIssues}</div>
        <div style="font-size: 10px; color: #b45309; font-weight: 600;">Open / En cours</div>
      </div>` : ''}
      <div style="flex: 1; min-width: 120px; background: #ede9fe; border: 1px solid #c4b5fd; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: 800; color: #5b21b6;">${avgResolutionTime}</div>
        <div style="font-size: 10px; color: #7c3aed; font-weight: 600;">Avg Resolution / Moy. résolution</div>
      </div>
    </div>
  `;

  // Insert summary before the table
  html = html.replace('<!-- DATA TABLE -->', `${summaryHTML}\n        <!-- DATA TABLE -->`);

  return html;
};
