import { LANGUAGE_CODES } from '@/config/languageConfig';
import { privateCrawlerPaths } from './robots';

describe('private crawler paths', () => {
  const paths = privateCrawlerPaths();

  it('covers each supported locale’s private route roots and descendants', () => {
    for (const locale of LANGUAGE_CODES) {
      for (const route of [
        'admin',
        'server',
        'cashier',
        'kitchen-staff',
        'auth',
        'account',
        'cart',
        'checkout',
        'orders',
        'my-orders',
        'my-reservations',
        'dev-portal',
        'scan',
        'delete-account',
        'forgot-password',
        'reset-password',
        'verify-email',
      ]) {
        expect(paths).toContain(`/${locale}/${route}$`);
        expect(paths).toContain(`/${locale}/${route}/`);
      }
    }
    expect(paths).toContain('/api/');
  });

  it('keeps public locale pages outside the private route policy', () => {
    expect(paths.some((path) => /\/(?:menu|privacy-policy|terms-of-usage)(?:\/|$)/.test(path))).toBe(false);
    expect(paths).not.toContain('/fr/cart');
  });
});
