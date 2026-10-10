import { THERMAL_BASE_STYLES } from './baseStyles';
import { TENANT_LOCALE } from '@/utils/currency';

export interface ReceiptOptions {
  paperWidthMm?: 58 | 80;
  locale?: string;
}

export function receiptDocumentAttributes(options: ReceiptOptions = {}): string {
  const locale = Intl.getCanonicalLocales(options.locale ?? TENANT_LOCALE)[0] ?? TENANT_LOCALE;
  const direction = /^(ar|he|fa|ur)(-|$)/.test(locale) ? 'rtl' : 'ltr';
  return `lang="${locale}" dir="${direction}"`;
}

export function receiptStyles(options: ReceiptOptions = {}): string {
  if (options.paperWidthMm !== 58) return THERMAL_BASE_STYLES;
  return (
    THERMAL_BASE_STYLES.replace('80mm auto', '58mm auto').replace('max-width: 300px', 'max-width: 206px') +
    '\nbody { font-size: 9pt; overflow-wrap: anywhere; --receipt-detail-size: 9pt; --receipt-indent: 8px; --receipt-child-offset: 0px; } .header h1 { font-size: 13pt; } .total-line { font-size: 12pt; }'
  );
}

export function receiptDate(value: string | Date, options: ReceiptOptions = {}): string {
  return new Date(value).toLocaleString(options.locale ?? TENANT_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
