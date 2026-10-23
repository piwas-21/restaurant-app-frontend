import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentDraft } from '@/hooks/orderAmendments/orderAmendmentTypes';
import { getProductById } from '@/services/menuService';
import OrderAmendmentCatalogComposer from './OrderAmendmentCatalogComposer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'fr' }, t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));
jest.mock('@/components/server/take-order/TakeOrderMenuPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/server/take-order/useWaiterMenu', () => ({
  useWaiterMenu: () => ({
    products: [{ id: 'bread', name: 'Pain', basePrice: 2 }],
    selectedProductForCustomization: { id: 'bread', name: 'Pain', basePrice: 2 },
    setSelectedProductForCustomization: jest.fn(),
  }),
}));

const draft: OrderAmendmentDraft = {
  additions: [],
  changes: [],
  reason: '',
  preparingOverrideAcknowledged: false,
  releaseAdditionsToKitchen: true,
  localProviderSupplementConsent: false,
  providerConsentNote: '',
};
const order = { id: 'order', type: 'DineIn' } as OrderDto;
function Harness({ replacement = false }: { replacement?: boolean }) {
  const [current, setCurrent] = useState<OrderAmendmentDraft>({
    ...draft,
    changes: replacement ? [{ kind: 'Replace', orderItemId: 'original', startOrdinal: 1, quantity: 2 }] : [],
  });
  return (
    <>
      <OrderAmendmentCatalogComposer order={order} draft={current} onDraftChange={setCurrent} />
      <output data-testid="request">{JSON.stringify(current)}</output>
    </>
  );
}

beforeEach(() => {
  jest.mocked(getProductById).mockResolvedValue({
    success: true,
    data: {
      id: 'bread',
      name: 'Pain',
      basePrice: 2,
      variations: [],
      detailedIngredients: [],
      suggestedSideItems: [],
      allergens: [],
    },
  } as Awaited<ReturnType<typeof getProductById>>);
});

it('adds three units through the actual quantity control in one amendment draft change', async () => {
  render(<Harness />);
  await screen.findByText('This product has no customization options');
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
  fireEvent.click(screen.getByRole('button', { name: /Add to Order/ }));
  expect(screen.getByText('3× Pain')).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId('request').textContent ?? '{}').additions).toEqual([
    expect.objectContaining({ productId: 'bread', quantity: 3, unitPrice: 2 }),
  ]);
});

it('retains the selected source-unit range when choosing a replacement', async () => {
  render(<Harness replacement />);
  await screen.findByText('This product has no customization options');
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
  fireEvent.click(screen.getByRole('button', { name: /Add to Order/ }));
  const request = JSON.parse(screen.getByTestId('request').textContent ?? '{}');
  expect(request.additions).toEqual([]);
  expect(request.changes[0]).toMatchObject({ quantity: 2, current: { productId: 'bread', quantity: 2 } });
});
