import { formatCurrency } from '@/utils/currency';
import type { OrderItemIngredientDto } from '@/types/order';
import { makeOrderItem } from '../__fixtures__/bundleOrderFixture';
import { buildChildItemsHtml, ingredientRowHtml } from './receiptHtml';

it('uses the default removal label and parent quantity for a standalone ingredient row', () => {
  const onion: OrderItemIngredientDto = {
    ingredientId: 'onion',
    ingredientName: 'Onion',
    quantity: 0,
    isRemoved: true,
    quantityBasis: 'PerParentUnit',
    configurationScope: 'SharedAcrossParentUnits',
  };

  const html = ingredientRowHtml(onion, 16);

  expect(html).toContain('NO Onion');
  expect(html).not.toContain('(each)');
});

it('renders child extras and ordinary sides with default labels, parent scope and price formatting', () => {
  const children = [
    makeOrderItem({
      id: 'side',
      productName: 'Side dish',
      quantity: 2,
      itemTotal: 4.25,
      compositionRole: 'Side',
      quantityBasis: 'PerParentUnit',
      configurationScope: 'SharedAcrossParentUnits',
    }),
    makeOrderItem({
      id: 'extra',
      productName: 'Extra sauce',
      quantity: 1,
      itemTotal: 1.5,
      compositionRole: 'Extra',
    }),
  ];

  const html = buildChildItemsHtml(children, { showPrices: true });

  expect(html).toContain(`2x Side dish (${formatCurrency(4.25)})`);
  expect(html).toContain(`+ 1x Extra sauce (${formatCurrency(1.5)})`);
  expect(html).not.toContain('Side dish (each)');
  expect(html).not.toContain('Extra sauce (each)');
});
