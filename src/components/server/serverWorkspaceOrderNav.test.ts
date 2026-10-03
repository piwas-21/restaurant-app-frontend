import { serverOrderNavItem } from './serverWorkspaceOrderNav';
import i18next from 'i18next';
import french from '@/locales/fr.json';

describe('serverOrderNavItem', () => {
  const translate = (key: string) => key;

  it('shows Orders only when the amendment workspace flag is enabled', () => {
    expect(serverOrderNavItem(false, translate)).toEqual([]);
    expect(serverOrderNavItem(true, translate)).toEqual([{ href: '/server/orders', label: 'serverOrders.title' }]);
  });

  it('localizes shared dashboard navigation before an order route bundle is loaded', async () => {
    const instance = i18next.createInstance();
    await instance.init({ lng: 'fr-CH', fallbackLng: 'en', resources: { fr: { translation: french } } });
    expect(serverOrderNavItem(true, (key, fallback) => instance.t(key, fallback))).toEqual([
      { href: '/server/orders', label: 'Commandes' },
    ]);
    expect(instance.hasResourceBundle('fr', 'translation')).toBe(true);
    expect(instance.getResource('fr', 'translation', 'serverOrders.search')).toBeUndefined();
  });
});
