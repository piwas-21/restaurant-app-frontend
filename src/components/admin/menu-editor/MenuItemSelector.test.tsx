import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import MenuItemSelector from './MenuItemSelector';
import { searchProducts } from '@/services/productService';

/**
 * The bundle option picker and the OPTION-ONLY opt-in (frontend #631).
 *
 * This is the picker that decides which products a bundle section offers — "choose exactly 2 meats
 * out of 6". The six meats are `isComponent` products, which `GET /api/Products` hides from every
 * caller that does not ask for them, so WITHOUT the opt-in this search can never find the only
 * items the flag was invented for and the whole feature is unreachable from the admin UI.
 *
 * What is asserted is the ARGUMENT here, because the component's contract with the service ends
 * there; `productService.test.ts` owns the other half — that the option becomes a query-string
 * parameter — so neither half can pass while the wire request is wrong.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key) }),
}));

jest.mock('@/services/productService', () => ({ searchProducts: jest.fn() }));

const mockSearchProducts = searchProducts as jest.MockedFunction<typeof searchProducts>;

const MEAT = { id: 'meat-1', name: 'Kebab de boeuf', basePrice: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockSearchProducts.mockResolvedValue({ success: true, data: { items: [MEAT] } } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

/** Types a term and lets the 300ms debounce fire, then flushes the resolved search. */
async function search(term: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: term } });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
}

describe('MenuItemSelector — finding an option-only item', () => {
  it('opts into option-only items, the only products this picker exists to choose', async () => {
    render(<MenuItemSelector items={[]} onChange={jest.fn()} maxSelection={2} />);

    await search('kebab');

    expect(mockSearchProducts).toHaveBeenCalledWith('kebab', { includeComponents: true });
  });

  it('offers the option-only row it found, and adds it to the section', async () => {
    const onChange = jest.fn();
    render(<MenuItemSelector items={[]} onChange={onChange} maxSelection={2} />);

    await search('kebab');
    fireEvent.click(screen.getByText(MEAT.name));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ productId: MEAT.id, productName: MEAT.name })]);
  });
});
