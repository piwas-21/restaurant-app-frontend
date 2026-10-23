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

it('omits frozen ingredient components from cashier bills and keeps them in kitchen tickets', () => {
  const children = [
    makeOrderItem({ id: 'sauce', productName: 'Harissa', compositionRole: 'Sauce' }),
    makeOrderItem({ id: 'ingredient', productName: 'Sugar', compositionRole: 'Ingredient' }),
  ];
  expect(buildChildItemsHtml(children, { showPrices: false, withIngredients: false })).toBe('');
  const kitchen = buildChildItemsHtml(children, { showPrices: false, withIngredients: true });
  expect(kitchen).toContain('Harissa');
  expect(kitchen).toContain('Sugar');
});

it('prints escaped nested instructions independently of ingredient visibility without losing hidden variations', () => {
  const children = [
    makeOrderItem({
      id: 'dish',
      productName: 'Plate',
      compositionRole: 'Dish',
      presentationLabel: 'Assiette',
      variationName: 'Pain',
      specialInstructions: 'Pain',
      sideItems: [
        makeOrderItem({
          id: 'sauce',
          productName: 'Sauce',
          compositionRole: 'Sauce',
          specialInstructions: 'À part <b>bread</b>',
        }),
      ],
    }),
  ];
  const html = buildChildItemsHtml(children, { showPrices: false, withIngredients: false });
  expect(html).toContain('Pain');
  expect(html).toContain('À part &lt;b&gt;bread&lt;/b&gt;');
  expect(html).not.toContain('<b>bread</b>');
});
