/**
 * QR Code Utility Functions
 * Helpers for QR code generation, download, and print functionality
 */

/**
 * Generate full URL with QR data for table ordering
 */
export function generateQRCodeURL(qrData: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${baseUrl}/scan?qr=${encodeURIComponent(qrData)}`;
}

/**
 * Extract table information from QR code data
 */
export function extractTableFromQR(qrData: string): { tableId: string; tableNumber: string } | null {
  try {
    // QR data format: "table_{tableId}_{guid}"
    const parts = qrData.split('_');
    if (parts.length >= 2 && parts[0] === 'table') {
      return {
        tableId: parts[1],
        tableNumber: '', // Will be filled by API validation
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Download QR code as PNG image
 */
export function downloadQRCode(canvas: HTMLCanvasElement, fileName: string): void {
  try {
    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Failed to create blob from canvas');
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.png`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch {
    throw new Error('Failed to download QR code');
  }
}

/**
 * Print QR code
 */
export function printQRCode(
  canvas: HTMLCanvasElement,
  tableNumber: string,
  translations?: {
    scanToOrder: string;
    table: string;
    instructions: string;
    footer: string;
  },
): void {
  try {
    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');

    // Default translations (English)
    const t = translations || {
      scanToOrder: 'Scan to Order',
      table: 'Table',
      instructions:
        'Scan this QR code with your phone camera to view our menu and place your order directly from your table.',
      footer: 'Rumi Restaurant - Digital Ordering System',
    };

    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Failed to open print window. Please check popup settings.');
    }

    // Generate print HTML with better layout
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${t.table} ${tableNumber}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              width: 210mm;
              height: 297mm;
              padding: 20mm;
              background: white;
            }
            .container {
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100%;
            }
            h1 {
              font-size: 2.5rem;
              margin-bottom: 1rem;
              color: #1a1a1a;
              font-weight: 600;
            }
            .table-number {
              font-size: 4rem;
              font-weight: bold;
              color: #c0392b;
              margin-bottom: 2rem;
            }
            .qr-wrapper {
              margin: 2rem 0;
            }
            img {
              width: 300px;
              height: 300px;
              border: 3px solid #e5e7eb;
              border-radius: 12px;
              padding: 1rem;
              background: white;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            .instructions {
              margin-top: 2rem;
              font-size: 1.25rem;
              color: #4b5563;
              line-height: 1.8;
              max-width: 500px;
            }
            .footer {
              margin-top: 3rem;
              font-size: 1rem;
              color: #9ca3af;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${t.scanToOrder}</h1>
            <div class="table-number">${t.table} ${tableNumber}</div>
            <div class="qr-wrapper">
              <img src="${dataUrl}" alt="QR Code for ${t.table} ${tableNumber}" />
            </div>
            <div class="instructions">
              ${t.instructions}
            </div>
            <div class="footer">
              ${t.footer}
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  } catch {
    throw new Error('Failed to print QR code');
  }
}

/**
 * Download multiple QR codes as a PDF (future enhancement)
 */
export function downloadAllQRCodesAsPDF(qrCodes: Array<{ canvas: HTMLCanvasElement; tableNumber: string }>): void {
  // TODO: Implement PDF generation using library like jsPDF
  throw new Error(`Bulk PDF download not yet implemented. ${qrCodes.length} QR codes pending.`);
}

/**
 * Validate QR code format
 */
export function isValidQRCodeFormat(qrData: string): boolean {
  if (!qrData || typeof qrData !== 'string') {
    return false;
  }

  // Check format: "table_{tableId}_{guid}"
  const parts = qrData.split('_');
  return parts.length >= 3 && parts[0] === 'table';
}

/**
 * Format QR code generation date
 */
export function formatQRGeneratedDate(date: string | Date | null | undefined): string {
  if (!date) {
    return 'Not generated';
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
}
