import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductCustomization from './ProductCustomization';
import { getProductById } from '@/services/menuService';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));

const detail = (hideBaseProduct: boolean) => ({
  success: true,
  data: {
    id: 'p1',
    name: 'Günün tatlısı',
    basePrice: 6,
    hideBaseProduct,
    variations: [
      { id: 'sutlac', name: 'Sütlaç', priceModifier: 1, finalPrice: 7, isActive: true, displayOrder: 2 },
      { id: 'revani', name: 'Revani', priceModifier: 0, finalPrice: 6, isActive: true, displayOrder: 1 },
    ],
    detailedIngredients: [],
    suggestedSideItems: [],
    allergens: [],
  },
});

/**
 * Track F / F2, named risk 3 — this screen has no base row at all: "no variation" is expressed by
 * TAPPING THE SELECTED ONE AGAIN. For a product whose base is hidden that de-select builds a line
 * the server refuses (backend #399), so it has to be withheld here rather than 400 at the till.
 */
describe('ProductCustomization — a product that hides its base row', () => {
  const product = { id: 'p1', name: 'Günün tatlısı', basePrice: 6 } as never;

  const open = (hideBaseProduct: boolean) => {
    (getProductById as jest.Mock).mockResolvedValue(detail(hideBaseProduct));
    return render(<ProductCustomization product={product} isOpen onClose={jest.fn()} onConfirm={jest.fn()} />);
  };

  const variationButton = (name: string) => screen.getByText(name).closest('button') as HTMLButtonElement;

  it('opens on the first variation in display order, because nothing else is orderable', () => {
    open(true);

    return waitFor(() => expect(variationButton('Revani').className).toContain('selected'));
  });

  it('refuses to de-select it — tapping the chosen variation again keeps it', async () => {
    open(true);
    await waitFor(() => expect(variationButton('Revani').className).toContain('selected'));

    fireEvent.click(variationButton('Revani'));

    expect(variationButton('Revani').className).toContain('selected');
  });

  it('still lets staff switch to another variation', async () => {
    open(true);
    await waitFor(() => expect(variationButton('Revani').className).toContain('selected'));

    fireEvent.click(variationButton('Sütlaç'));

    expect(variationButton('Sütlaç').className).toContain('selected');
    expect(variationButton('Revani').className).not.toContain('selected');
  });

  it('leaves the ordinary product alone: no pre-selection, and de-select still works', async () => {
    open(false);
    await waitFor(() => expect(variationButton('Revani')).toBeInTheDocument());

    expect(variationButton('Revani').className).not.toContain('selected');

    fireEvent.click(variationButton('Revani'));
    expect(variationButton('Revani').className).toContain('selected');

    fireEvent.click(variationButton('Revani'));
    expect(variationButton('Revani').className).not.toContain('selected');
  });
});
