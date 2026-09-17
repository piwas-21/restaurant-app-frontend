import React from 'react';
import { render, screen } from '@testing-library/react';
import MenuScheduleEditor from './MenuScheduleEditor';
import type { MenuDefinition } from '@/types/menu';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const definition: MenuDefinition = {
  id: 'definition-1',
  parentOfferProductId: 'product-guid-1',
  parentOfferVariationId: 'variation-guid-1',
  isAlwaysAvailable: true,
  availableMonday: true,
  availableTuesday: true,
  availableWednesday: true,
  availableThursday: true,
  availableFriday: true,
  availableSaturday: true,
  availableSunday: true,
  sections: [],
};

describe('MenuScheduleEditor', () => {
  it('renders resolved parent names instead of opaque product and variation ids', () => {
    render(
      <MenuScheduleEditor
        menuDefinition={definition}
        onChange={jest.fn()}
        parentProductName="Tacos 1 Viande"
        parentVariationName="Large"
      />,
    );

    const summary = screen.getByLabelText('menu_bundles');
    expect(summary).toHaveTextContent('Tacos 1 Viande');
    expect(summary).toHaveTextContent('Large');
    expect(summary).not.toHaveTextContent('product-guid-1');
    expect(summary).not.toHaveTextContent('variation-guid-1');
  });

  it('resolves names from the parent menu item when detail data provides them', () => {
    render(
      <MenuScheduleEditor
        menuDefinition={{
          ...definition,
          sections: [
            {
              id: 'section-1',
              name: 'Principal',
              displayOrder: 0,
              isRequired: true,
              minSelection: 1,
              maxSelection: 1,
              items: [
                {
                  id: 'item-1',
                  productId: 'product-guid-1',
                  productVariationId: 'variation-guid-1',
                  productName: 'Tacos 1 Viande',
                  productVariationName: 'Large',
                  additionalPrice: 0,
                  displayOrder: 0,
                  isDefault: true,
                },
              ],
            },
          ],
        }}
        onChange={jest.fn()}
      />,
    );

    const summary = screen.getByLabelText('menu_bundles');
    expect(summary).toHaveTextContent('Tacos 1 Viande');
    expect(summary).toHaveTextContent('Large');
    expect(summary).not.toHaveTextContent('product-guid-1');
    expect(summary).not.toHaveTextContent('variation-guid-1');
  });
});
