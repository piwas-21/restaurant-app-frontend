import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '@/locales/en.json';
import tr from '@/locales/tr.json';
import { fidelityPointsService } from '@/services/fidelityPointsService';
import { TransactionType } from '@/types/fidelity';
import PointsHistoryModal from './PointsHistoryModal';

jest.mock('@/services/fidelityPointsService', () => ({ fidelityPointsService: { getHistory: jest.fn() } }));

it.each([
  ['en', en, 'Earned points reversed', 'Redeemed points restored'],
  ['tr', tr, 'Kazanılan puanlar geri alındı', 'Kullanılan puanlar geri yüklendi'],
] as const)(
  'shows exact signed compensation movements in %s without a raw API enum',
  async (lang, messages, deducted, restored) => {
    const transaction = { userId: null, description: null, createdAt: '2026-10-04T12:00:00Z' };
    jest.mocked(fidelityPointsService.getHistory).mockResolvedValueOnce([
      { ...transaction, id: 'movement-1', transactionType: TransactionType.EarnedClawback, points: -10 },
      { ...transaction, id: 'movement-2', transactionType: TransactionType.RedemptionRestored, points: 6 },
    ]);
    const instance = i18next.createInstance();
    await instance.init({ lng: lang, fallbackLng: false, resources: { [lang]: { translation: messages } } });
    render(
      <I18nextProvider i18n={instance}>
        <PointsHistoryModal isOpen onClose={jest.fn()} />
      </I18nextProvider>,
    );
    expect(await screen.findByText(deducted)).toBeVisible();
    expect(screen.getByText(restored)).toBeVisible();
    expect(screen.getByText('-10')).toBeVisible();
    expect(screen.getByText('+6')).toBeVisible();
    expect(screen.queryByText('EarnedClawback')).not.toBeInTheDocument();
    expect(screen.queryByText('RedemptionRestored')).not.toBeInTheDocument();
  },
);
