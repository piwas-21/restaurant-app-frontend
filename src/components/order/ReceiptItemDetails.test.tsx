import { render, screen } from '@testing-library/react';
import ReceiptItemDetails from './ReceiptItemDetails';
import { makeOrderItem } from '@/utils/__fixtures__/bundleOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key }),
}));

it('retains repeated ingredient occurrences and their separate frozen quantity scopes', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const item = makeOrderItem({
      id: 'dish',
      productName: 'Taco',
      quantity: 2,
      ingredientCustomizations: [
        {
          ingredientId: 'cheddar',
          ingredientName: 'Cheddar',
          quantity: 1,
          isAddOn: true,
          isRemoved: false,
          quantityBasis: 'PerParentUnit',
          configurationScope: 'SharedAcrossParentUnits',
        },
        {
          ingredientId: 'cheddar',
          ingredientName: 'Cheddar',
          quantity: 3,
          isAddOn: true,
          isRemoved: false,
          quantityBasis: 'Unknown',
          configurationScope: 'Unknown',
        },
      ],
    });
    const { rerender } = render(<ReceiptItemDetails item={item} />);
    expect(screen.getAllByText('Cheddar')).toHaveLength(2);
    const ingredientRows = screen.getAllByText('Cheddar').map((node) => node.closest('li'));
    expect(ingredientRows[0]).toHaveTextContent('(each)');
    expect(ingredientRows[0]).not.toHaveTextContent('×1');
    expect(ingredientRows[1]).toHaveTextContent('×3');
    expect(ingredientRows[1]).not.toHaveTextContent('Recorded quantity');
    rerender(<ReceiptItemDetails item={{ ...item, ingredientCustomizations: [item.ingredientCustomizations![1]] }} />);
    expect(screen.getAllByText('Cheddar')).toHaveLength(1);
    expect(screen.getByText('Cheddar').closest('li')).toHaveTextContent('×3');
    expect(screen.getByText('Cheddar').closest('li')).not.toHaveTextContent('(each)');
    expect(error).not.toHaveBeenCalled();
  } finally {
    error.mockRestore();
  }
});

it('prints unknown child counts exactly and leaves line totals unlabelled', () => {
  const item = makeOrderItem({
    id: 'menu',
    productName: 'Menu',
    quantity: 2,
    sideItems: [
      makeOrderItem({
        id: 'line-total',
        productName: 'Beef',
        quantity: 4,
        quantityBasis: 'LineTotal',
      }),
      makeOrderItem({ id: 'unknown', productName: 'Legacy Dip', quantity: 7, quantityBasis: 'Unknown' }),
      makeOrderItem({
        id: 'per-parent',
        productName: 'Fries',
        quantity: 1,
        quantityBasis: 'PerParentUnit',
        configurationScope: 'SharedAcrossParentUnits',
      }),
    ],
  });

  const { container } = render(<ReceiptItemDetails item={item} />);
  const text = container.textContent ?? '';
  expect(text).toContain('4× Beef');
  expect(text).toContain('7× Legacy Dip');
  expect(text).toContain('1× Fries (each)');
  expect(text).not.toContain('Recorded quantity');
  expect(text).not.toContain('Total for this line');
});
