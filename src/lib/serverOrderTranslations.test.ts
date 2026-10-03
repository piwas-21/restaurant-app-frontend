import i18next from 'i18next';
import french from '@/locales/fr.json';
import frenchServerOrders from '@/locales/order-workspace/fr.json';
import { loadServerOrderTranslations } from './serverOrderTranslations';

describe('server order locale chunks', () => {
  it('keeps detailed route copy out of the shared locale and merges only the requested locale', async () => {
    expect(french.serverOrders).toEqual({ title: 'Commandes' });
    expect(frenchServerOrders.serverOrders.title).toBe('Commandes');
    const instance = i18next.createInstance();
    await instance.init({
      lng: 'fr-CH',
      fallbackLng: 'en',
      resources: { fr: { translation: { cashier: { workspace: { title: 'Caisse' } } } } },
    });

    await Promise.all([loadServerOrderTranslations(instance, 'fr-CH'), loadServerOrderTranslations(instance, 'fr-CH')]);

    expect(instance.getResource('fr', 'translation', 'serverOrders.title')).toBe('Commandes');
    expect(instance.getResource('fr', 'translation', 'orderAmendments.feature_disabled')).toBe(
      'Les modifications de commande ne sont pas activées pour ce restaurant.',
    );
    expect(instance.getResource('fr', 'translation', 'cashier.workspace.title')).toBe('Caisse');
    expect(instance.getResource('en', 'translation', 'serverOrders')).toBeUndefined();
  });
});
