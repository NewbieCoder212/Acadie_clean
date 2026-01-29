/**
 * PDF Download Utility for Web Browsers
 * Creates actual PDF files that download directly - no printing required
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface PDFReportData {
  title: string;
  businessName: string;
  location?: string;
  dateRange: { start: Date; end: Date };
  columns: string[];
  rows: Array<{ cells: Array<{ text: string; isCheck?: boolean; isX?: boolean }> }>;
  legendItems?: Array<{ code: string; description: string }>;
}

const formatDate = (d: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

/**
 * Generate and download a PDF report
 */
export const downloadPDFReport = async (data: PDFReportData): Promise<boolean> => {
  try {
    // Create a new PDF document - landscape letter size
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Letter size in landscape: 792 x 612 points
    const pageWidth = 792;
    const pageHeight = 612;
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    // Colors
    const headerBg = rgb(6/255, 95/255, 70/255); // #065f46
    const green = rgb(5/255, 150/255, 105/255); // #059669
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.9, 0.9, 0.9);
    const lightGreen = rgb(236/255, 253/255, 245/255); // #ecfdf5
    const white = rgb(1, 1, 1);
    const red = rgb(220/255, 38/255, 38/255); // #dc2626

    // Calculate column widths
    const numCols = data.columns.length;
    // First two columns (Date, Staff/Location) get more space
    const firstColWidth = 90;
    const secondColWidth = 80;
    const remainingWidth = contentWidth - firstColWidth - secondColWidth;
    const otherColWidth = remainingWidth / (numCols - 2);

    const getColX = (colIndex: number): number => {
      if (colIndex === 0) return margin;
      if (colIndex === 1) return margin + firstColWidth;
      return margin + firstColWidth + secondColWidth + (otherColWidth * (colIndex - 2));
    };

    const getColWidth = (colIndex: number): number => {
      if (colIndex === 0) return firstColWidth;
      if (colIndex === 1) return secondColWidth;
      return otherColWidth;
    };

    // Rows per page calculation
    const headerHeight = 80;
    const tableHeaderHeight = 25;
    const rowHeight = 22;
    const footerHeight = 60;
    const availableHeight = pageHeight - margin - headerHeight - tableHeaderHeight - footerHeight - margin;
    const rowsPerPage = Math.floor(availableHeight / rowHeight);

    // Split data into pages
    const totalRows = data.rows.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      // ===== HEADER =====
      // Title
      page.drawText(data.title, {
        x: margin,
        y: y - 20,
        size: 18,
        font: fontBold,
        color: headerBg,
      });

      // Business name and location
      page.drawText(data.location || data.businessName, {
        x: margin,
        y: y - 40,
        size: 12,
        font: fontBold,
        color: black,
      });

      // Date range
      const dateRangeText = `${formatDate(data.dateRange.start)} – ${formatDate(data.dateRange.end)}`;
      page.drawText(dateRangeText, {
        x: margin,
        y: y - 55,
        size: 10,
        font: font,
        color: gray,
      });

      // Page number (right side)
      const pageText = `Page ${pageNum + 1} of ${totalPages}`;
      const pageTextWidth = font.widthOfTextAtSize(pageText, 10);
      page.drawText(pageText, {
        x: pageWidth - margin - pageTextWidth,
        y: y - 20,
        size: 10,
        font: font,
        color: gray,
      });

      // Acadia CleanIQ branding (right side)
      page.drawText('Acadia CleanIQ', {
        x: pageWidth - margin - font.widthOfTextAtSize('Acadia CleanIQ', 12),
        y: y - 40,
        size: 12,
        font: fontBold,
        color: green,
      });

      y -= headerHeight;

      // ===== TABLE HEADER =====
      // Header background
      page.drawRectangle({
        x: margin,
        y: y - tableHeaderHeight,
        width: contentWidth,
        height: tableHeaderHeight,
        color: headerBg,
      });

      // Header text
      data.columns.forEach((col, i) => {
        const colX = getColX(i);
        const colW = getColWidth(i);
        const textWidth = fontBold.widthOfTextAtSize(col, 9);
        const textX = i < 2 ? colX + 4 : colX + (colW - textWidth) / 2;

        page.drawText(col, {
          x: textX,
          y: y - tableHeaderHeight + 8,
          size: 9,
          font: fontBold,
          color: white,
        });
      });

      y -= tableHeaderHeight;

      // ===== TABLE ROWS =====
      const startRow = pageNum * rowsPerPage;
      const endRow = Math.min(startRow + rowsPerPage, totalRows);

      for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
        const row = data.rows[rowIdx];
        const isOdd = (rowIdx - startRow) % 2 === 0;

        // Row background
        if (isOdd) {
          page.drawRectangle({
            x: margin,
            y: y - rowHeight,
            width: contentWidth,
            height: rowHeight,
            color: lightGreen,
          });
        }

        // Row border
        page.drawLine({
          start: { x: margin, y: y - rowHeight },
          end: { x: margin + contentWidth, y: y - rowHeight },
          thickness: 0.5,
          color: lightGray,
        });

        // Cell content
        row.cells.forEach((cell, i) => {
          const colX = getColX(i);
          const colW = getColWidth(i);

          if (cell.isCheck) {
            // Green checkmark
            const checkX = colX + (colW / 2) - 4;
            page.drawText('✓', {
              x: checkX,
              y: y - rowHeight + 6,
              size: 14,
              font: font,
              color: green,
            });
          } else if (cell.isX) {
            // Red X
            const xPos = colX + (colW / 2) - 4;
            page.drawText('✗', {
              x: xPos,
              y: y - rowHeight + 6,
              size: 14,
              font: font,
              color: red,
            });
          } else {
            // Regular text
            const text = cell.text.length > 15 ? cell.text.substring(0, 14) + '…' : cell.text;
            const textX = i < 2 ? colX + 4 : colX + (colW - font.widthOfTextAtSize(text, 9)) / 2;
            page.drawText(text, {
              x: textX,
              y: y - rowHeight + 7,
              size: 9,
              font: font,
              color: black,
            });
          }
        });

        y -= rowHeight;
      }

      // ===== FOOTER =====
      const footerY = margin + footerHeight;

      // Legend (only on first page)
      if (pageNum === 0 && data.legendItems && data.legendItems.length > 0) {
        page.drawText('Legend:', {
          x: margin,
          y: footerY - 10,
          size: 8,
          font: fontBold,
          color: gray,
        });

        let legendX = margin + 50;
        data.legendItems.forEach((item, idx) => {
          const legendText = `${item.code} = ${item.description}`;
          if (legendX + font.widthOfTextAtSize(legendText, 7) > pageWidth - margin) {
            // Would overflow - skip for now
            return;
          }
          page.drawText(legendText, {
            x: legendX,
            y: footerY - 10,
            size: 7,
            font: font,
            color: gray,
          });
          legendX += font.widthOfTextAtSize(legendText, 7) + 15;
        });

        // Checkmark legend
        page.drawText('✓ = Complete', {
          x: margin,
          y: footerY - 22,
          size: 7,
          font: font,
          color: green,
        });
        page.drawText('✗ = Incomplete', {
          x: margin + 70,
          y: footerY - 22,
          size: 7,
          font: font,
          color: red,
        });
      }

      // Generated timestamp
      const generatedText = `Generated: ${new Date().toLocaleString()}`;
      page.drawText(generatedText, {
        x: pageWidth - margin - font.widthOfTextAtSize(generatedText, 8),
        y: margin + 10,
        size: 8,
        font: font,
        color: gray,
      });

      // Powered by text
      page.drawText('Powered by Acadia CleanIQ', {
        x: margin,
        y: margin + 10,
        size: 8,
        font: font,
        color: gray,
      });
    }

    // Serialize to bytes
    const pdfBytes = await pdfDoc.save();

    // Create filename
    const dateStr = formatDate(new Date()).replace(/,/g, '').replace(/ /g, '-');
    const filename = `${data.title.replace(/\s+/g, '-')}_${dateStr}.pdf`;

    // Create blob from PDF bytes - convert to regular array for compatibility
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Check if we're on iOS Safari (doesn't support download attribute well)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS) {
      // iOS: Open in new tab - user can then use Share to save
      window.open(url, '_blank');
      // Don't revoke immediately on iOS
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      // Desktop/Android: Use download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Cleanup after short delay
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    return true;
  } catch (error) {
    console.error('[PDF Download] Error generating PDF:', error);
    return false;
  }
};
