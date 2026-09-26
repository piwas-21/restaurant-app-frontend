import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MenuDefinition } from '@/types/menu';
import { OrderType } from '@/types/order';
import { quoteProduct } from '@/services/productQuoteService';
import { bundleQuoteInputsSchema } from './bundlePriceQuoteUtils';
import BundlePriceQuotePreview from './BundlePriceQuotePreview';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${Object.values(values).join(',')}` : key),
  }),
}));
jest.mock('@/services/productQuoteService', () => ({ quoteProduct: jest.fn() }));

const mockQuote = quoteProduct as jest.MockedFunction<typeof quoteProduct>;

const menuDefinition: MenuDefinition = {
  id: 'menu-guid',
  isAlwaysAvailable: true,
  availableMonday: true,
  availableTuesday: true,
  availableWednesday: true,
  availableThursday: true,
  availableFriday: true,
  availableSaturday: true,
  availableSunday: true,
  sections: [
    {
      id: 'section-guid',
      name: 'Mains',
      displayOrder: 0,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [
        {
          id: 'section-item-guid',
          productId: 'child-product-guid',
          productVariationId: 'variation-guid',
          productVariationPriceModifier: 2.5,
          productName: 'Burger',
          additionalPrice: 1,
          displayOrder: 0,
          isDefault: true,
          customizationGroups: [
            {
              id: 'group-guid',
              name: 'Side',
              displayOrder: 0,
              isRequired: true,
              minSelection: 1,
              maxSelection: 1,
              includedFreeUnits: 0,
              isActive: true,
              content: {},
              ingredientOptions: [],
              productOptions: [
                {
                  id: 'member-guid',
                  optionProductId: 'side-product-guid',
                  optionProductName: 'Fries',
                  additionalPrice: 1.25,
                  displayOrder: 0,
                  isDefault: true,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('BundlePriceQuotePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuote.mockResolvedValue({ productId: 'menu-guid', quantity: 1, unitPrice: 20, totalPrice: 20 });
  });

  it('quotes the saved default choices, including variation and customization IDs', async () => {
    render(
      <BundlePriceQuotePreview
        productId="menu-guid"
        menuDefinition={menuDefinition}
        isDirty={false}
        isActive
        isAvailable
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'bundle_quote_request' }));
    expect(await screen.findByText('bundle_quote_total:CHF 20.00')).toBeInTheDocument();

    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockQuote).toHaveBeenCalledWith(
      'menu-guid',
      expect.objectContaining({
        quantity: 1,
        selectedMenuOptions: [
          expect.objectContaining({
            sectionId: 'section-guid',
            itemId: 'child-product-guid',
            productVariationId: 'variation-guid',
            quantity: 1,
            customizationSelections: [
              {
                groupId: 'group-guid',
                options: [{ kind: 1, optionId: 'member-guid', quantity: 1 }],
              },
            ],
          }),
        ],
      }),
      undefined,
    );
    const request = mockQuote.mock.calls[0][1];
    expect(request.selectedMenuOptions?.[0]).not.toHaveProperty('productVariationPriceModifier');
  });

  it('does not request a quote for a dirty saved bundle', () => {
    render(
      <BundlePriceQuotePreview productId="menu-guid" menuDefinition={menuDefinition} isDirty isActive isAvailable />,
    );

    expect(screen.getByRole('button', { name: 'bundle_quote_request' })).toBeDisabled();
    expect(screen.getByText('bundle_quote_save_changes_first')).toBeInTheDocument();
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it('sends and labels the selected order channel', async () => {
    render(
      <BundlePriceQuotePreview
        productId="menu-guid"
        menuDefinition={menuDefinition}
        isDirty={false}
        isActive
        isAvailable
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'bundle_quote_channel' }), {
      target: { value: OrderType.DineIn },
    });
    fireEvent.click(screen.getByRole('button', { name: 'bundle_quote_request' }));

    expect(await screen.findByText('bundle_quote_result_heading_channel:order_type_dine_in')).toBeInTheDocument();
    expect(mockQuote).toHaveBeenCalledWith('menu-guid', expect.anything(), OrderType.DineIn);
  });

  it('validates quote quantity and channel before sending the request', async () => {
    render(
      <BundlePriceQuotePreview
        productId="menu-guid"
        menuDefinition={menuDefinition}
        isDirty={false}
        isActive
        isAvailable
      />,
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: 'bundle_quote_quantity' }), {
      target: { value: '0' },
    });
    expect(screen.getByText('bundle_quote_invalid_input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bundle_quote_request' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'bundle_quote_request' }));
    expect(mockQuote).not.toHaveBeenCalled();

    expect(mockQuote).not.toHaveBeenCalled();
    expect(bundleQuoteInputsSchema.safeParse({ quantity: '2', requestedOrderType: 'Unsupported' }).success).toBe(false);
  });
});
