import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '@/locales/en.json';
import BillChargesTab from './BillChargesTab';
import { saveBillCharges } from '@/services/billChargeService';
import type { BillChargeConfiguration } from '@/types/billCharge';

const mockConfiguration: BillChargeConfiguration = {
  currency: 'CHF',
  rules: [
    {
      key: 'existing_fee',
      label: 'Handling',
      enabled: true,
      defaultAmount: 5,
      allowCustomAmount: true,
      roles: ['Cashier', 'Server'],
      orderTypes: ['DineIn'],
    },
  ],
};
const mockSetConfiguration = jest.fn();
jest.mock('@/hooks/useBillChargeConfiguration', () => ({
  useBillChargeConfiguration: () => ({
    configuration: mockConfiguration,
    setConfiguration: mockSetConfiguration,
    failed: false,
  }),
}));
jest.mock('@/services/billChargeService', () => ({ saveBillCharges: jest.fn() }));
const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } });
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(saveBillCharges).mockResolvedValue(mockConfiguration);
});
const mount = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <BillChargesTab />
    </I18nextProvider>,
  );

it('uses readable role chips, hides keys, preserves existing identity and saves edited settings', async () => {
  mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  expect(screen.queryByText('Field key')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('existing_fee')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cashier' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Server' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Name on the bill' }), { target: { value: 'Handling fee' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(saveBillCharges).toHaveBeenCalledWith({
      currency: 'CHF',
      rules: expect.arrayContaining([
        expect.objectContaining({ key: 'existing_fee', label: 'Handling fee', roles: ['Cashier'] }),
      ]),
    }),
  );
  expect(document.body.textContent).not.toContain('returned an object');
});

it('generates hidden stable keys for new charges and keeps inactive editor amount drafts', async () => {
  mount();
  await screen.findByRole('textbox', { name: 'Suggested amount' });
  const fee = screen.getByRole('textbox', { name: 'Suggested amount' });
  fireEvent.change(fee, { target: { value: '-2' } });
  fireEvent.click(screen.getByRole('button', { name: /Service fee Disabled/ }));
  fireEvent.click(screen.getByRole('button', { name: /Handling Staff can change it/ }));
  expect(screen.getByRole('textbox', { name: 'Suggested amount' })).toHaveValue('-2');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Suggested amount' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add custom charge' }));
  expect(screen.getByRole('textbox', { name: 'Name on the bill' })).toHaveValue('Custom charge');
  fireEvent.change(screen.getByRole('textbox', { name: 'Name on the bill' }), { target: { value: 'Packaging' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
  const rules = jest.mocked(saveBillCharges).mock.calls[0][0].rules;
  expect(rules.find((rule) => rule.label === 'Packaging')?.key).toMatch(/^charge_[a-f0-9]{32}$/);
  expect(new Set(rules.map((rule) => rule.key)).size).toBe(rules.length);
  expect(
    within(screen.getByRole('group', { name: 'Available to staff' })).getByRole('button', { name: 'Cashier' }),
  ).toBeInTheDocument();
});
