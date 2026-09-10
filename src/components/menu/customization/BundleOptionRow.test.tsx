import React from 'react';
import { render, screen } from '@testing-library/react';
import BundleOptionRow from './BundleOptionRow';
import type { MenuSectionItem } from '@/types/menu';

/**
 * The option row's price mark (2026-09-10 mcdoner partner request): a section option at 0
 * additional price is INCLUDED in the menu, and the row used to render no price mark at all for
 * it — a guest reading the frites step saw an unpriced row, not a free one. Zero now states
 * itself, in the same slot an upcharge marks.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const item = (additionalPrice: number): MenuSectionItem =>
  ({
    id: 'opt-1',
    productId: 'prod-1',
    productName: 'Frites',
    additionalPrice,
    displayOrder: 0,
    isDefault: false,
  }) as MenuSectionItem;

const renderRow = (additionalPrice: number) =>
  render(
    <BundleOptionRow
      item={item(additionalPrice)}
      sectionId="section-1"
      inputType="radio"
      isSelected={false}
      isDisabled={false}
      currentLanguage="en"
      onToggle={jest.fn()}
    />,
  );

describe('BundleOptionRow — the price mark', () => {
  it('marks a zero-surcharge option as free instead of showing nothing', () => {
    renderRow(0);

    expect(screen.getByText('menu_option_free')).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('keeps the upcharge mark for a priced option, with no free claim', () => {
    renderRow(2);

    expect(screen.getByText(/^\+/)).toBeInTheDocument();
    expect(screen.queryByText('menu_option_free')).not.toBeInTheDocument();
  });
});
