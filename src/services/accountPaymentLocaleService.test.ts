import type { i18n as I18nInstance } from 'i18next';
import { loadAccountPaymentLocale } from './accountPaymentLocaleService';

describe('account payment locale loader', () => {
  it('normalizes regional locales and merges the selected sidecar into the active resource store', async () => {
    const addResourceBundle = jest.fn();
    const instance = { addResourceBundle } as unknown as I18nInstance;

    await loadAccountPaymentLocale(instance, 'de-CH');

    expect(addResourceBundle).toHaveBeenCalledTimes(1);
    expect(addResourceBundle).toHaveBeenCalledWith(
      'de',
      'translation',
      expect.objectContaining({
        accountPayments: expect.objectContaining({ retry_original: 'Ursprüngliche Anfrage erneut versuchen' }),
      }),
      true,
      true,
    );
  });

  it('falls back to English for unsupported locale tags', async () => {
    const addResourceBundle = jest.fn();
    const instance = { addResourceBundle } as unknown as I18nInstance;

    await loadAccountPaymentLocale(instance, 'pt-BR');

    expect(addResourceBundle).toHaveBeenCalledWith(
      'en',
      'translation',
      expect.objectContaining({
        accountPayments: expect.objectContaining({ retry_original: 'Retry the original request' }),
      }),
      true,
      true,
    );
  });
});
