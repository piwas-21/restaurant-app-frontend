import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductCustomizationInBundle from './ProductCustomizationInBundle';
import type { DetailedIngredient } from '@/types/menu';

// Stub react-i18next so t() returns the key (or its fallback), matching how the
// component renders without an i18next provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const ingredient = (
  over: Partial<DetailedIngredient> & Pick<DetailedIngredient, 'id' | 'name'>,
): DetailedIngredient => ({
  isOptional: true,
  price: 1,
  isIncludedInBasePrice: false,
  isActive: true,
  displayOrder: 0,
  maxQuantity: 5,
  ...over,
});

const baseProps = () => ({
  isOpen: true,
  onClose: jest.fn(),
  productName: 'Coke',
  basePrice: 3,
  detailedIngredients: [ingredient({ id: 'ice', name: 'Ice' })],
  onConfirm: jest.fn(),
  currentLanguage: 'en' as const,
});

describe('ProductCustomizationInBundle (bundle-child drill-in)', () => {
  it('renders the ingredient and special-instructions sections', () => {
    render(<ProductCustomizationInBundle {...baseProps()} />);
    expect(screen.getByRole('heading', { name: 'Coke' })).toBeInTheDocument();
    expect(screen.getByText('Ice')).toBeInTheDocument();
    expect(screen.getByText('special_instructions')).toBeInTheDocument();
  });

  // Bundle-child side items were dropped (backend #151): a combo's sides belong in the
  // bundle definition, not as per-option extras. The drill-in must never emit a sides field.
  it('confirms a customization with no side-items field', () => {
    const props = baseProps();
    render(<ProductCustomizationInBundle {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    const customization = props.onConfirm.mock.calls[0][0];
    expect(customization).not.toHaveProperty('selectedSideItems');
    expect(customization).toMatchObject({
      selectedIngredients: ['ice'],
      ingredientQuantities: { ice: 1 },
    });
  });
});
