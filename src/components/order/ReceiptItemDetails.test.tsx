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
    expect(screen.getByText(/Per item: Taco/).closest('li')).toHaveTextContent('×1');
    expect(screen.getByText(/Recorded quantity/).closest('li')).toHaveTextContent('×3');
    rerender(<ReceiptItemDetails item={{ ...item, ingredientCustomizations: [item.ingredientCustomizations![1]] }} />);
    expect(screen.getAllByText('Cheddar')).toHaveLength(1);
    expect(screen.getByText(/Recorded quantity/).closest('li')).toHaveTextContent('×3');
    expect(error).not.toHaveBeenCalled();
  } finally {
    error.mockRestore();
  }
});
