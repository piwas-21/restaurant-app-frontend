import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { OrderType } from '@/types/order';
import type { MenuDefinition } from '@/types/menu';
import BundleGuestStepPreview from './BundleGuestStepPreview';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${Object.values(values).join(',')}` : key),
  }),
}));

const menuDefinition: MenuDefinition = {
  id: 'menu-1',
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
      id: 'drinks',
      name: 'Drinks',
      displayOrder: 2,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [
        {
          id: 'water',
          productId: 'water-id',
          productName: 'Water',
          additionalPrice: 1.5,
          displayOrder: 2,
          isDefault: true,
          availability: {
            canOrder: false,
            reason: 'WrongOrderType',
            allowedOrderTypes: [OrderType.Delivery],
            inheritsOrderTypes: false,
          },
        },
        {
          id: 'tea',
          productId: 'tea-id',
          productName: 'Tea',
          additionalPrice: 0,
          displayOrder: 1,
          isDefault: false,
          availability: {
            canOrder: false,
            reason: 'Unavailable',
            allowedOrderTypes: [],
            inheritsOrderTypes: true,
          },
        },
      ],
    },
    {
      id: 'mains',
      name: 'Mains',
      displayOrder: 1,
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [],
    },
  ],
};

describe('BundleGuestStepPreview', () => {
  it('shows guest choice order, price differences, and channel availability', () => {
    render(
      <BundleGuestStepPreview
        menuDefinition={menuDefinition}
        availability={{
          canOrder: false,
          reason: 'WrongOrderType',
          allowedOrderTypes: [OrderType.Takeaway],
        }}
      />,
    );

    const steps = document.querySelector('ol') as HTMLOListElement;
    expect(within(steps).getAllByRole('listitem')[0]).toHaveTextContent('Mains');
    expect(within(steps).getAllByRole('listitem')[1]).toHaveTextContent('Drinks');
    expect(screen.getByText('bundle_preview_wrong_channel:order_type_takeaway')).toBeInTheDocument();
    expect(screen.getByText('bundle_preview_wrong_channel:order_type_delivery')).toBeInTheDocument();
    expect(screen.getByText('bundle_preview_unavailable_settings')).toBeInTheDocument();
    expect(screen.getByText('bundle_preview_included_by_default')).toBeInTheDocument();
    expect(screen.getByText('+CHF 1.50')).toBeInTheDocument();
  });
});
