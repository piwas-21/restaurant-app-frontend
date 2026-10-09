import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const globalsCss = readFileSync(join(__dirname, 'globals.css'), 'utf8');

describe('global print visibility', () => {
  it('hides the table bill when an order details print root is mounted', () => {
    const printStart = globalsCss.indexOf('/* Print Styles');
    const fallbackSelector = globalsCss.indexOf('body:has(#order-details-print) #table-session-bill-print');

    expect(printStart).toBeGreaterThanOrEqual(0);
    expect(fallbackSelector).toBeGreaterThan(printStart);
    expect(globalsCss.slice(fallbackSelector)).toMatch(
      /^body:has\(#order-details-print\) #table-session-bill-print,\s*body:has\(#order-details-print\) #table-session-bill-print \*\s*\{\s*visibility:\s*hidden !important;/,
    );
  });
});
