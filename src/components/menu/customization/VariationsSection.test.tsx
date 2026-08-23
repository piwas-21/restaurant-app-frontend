import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import VariationsSection from './VariationsSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * Track F / F2 — the base ("no variation") row. RUMI's "Günün tatlısı" is a folder of desserts
 * rather than a dish, so ordering the parent itself must be impossible; hiding the row here is
 * presentation only, and the server refuses the same add (backend #399).
 */
describe('VariationsSection — the base product row', () => {
  const variations = [
    { id: 'revani', name: 'Revani', priceModifier: 0, isActive: true, displayOrder: 1 },
    { id: 'sutlac', name: 'Sütlaç', priceModifier: 1, isActive: true, displayOrder: 2 },
  ];

  const renderSection = (props: Partial<React.ComponentProps<typeof VariationsSection>> = {}) =>
    render(
      <VariationsSection
        variations={variations}
        selectedVariationId="revani"
        onVariationChange={jest.fn()}
        basePrice={6}
        currentLanguage="en"
        productName="Günün tatlısı"
        {...props}
      />,
    );

  it('offers the base product first by default — every existing product keeps that row', () => {
    renderSection();

    expect(screen.getByText('Günün tatlısı')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('withholds the base row when the product hides it, leaving only the variations', () => {
    renderSection({ hideBaseProduct: true });

    expect(screen.queryByText('Günün tatlısı')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByText('Revani')).toBeInTheDocument();
  });

  it('renders nothing at all when every variation is inactive, hidden base or not', () => {
    // The degrade, seen from this component: with no active variation there is no section, the
    // sheet falls back to the base product, and the server's guard agrees that it is orderable.
    // A section that rendered a variation-less list here would be an empty, unbuyable dish.
    const { container } = renderSection({
      hideBaseProduct: true,
      variations: variations.map((v) => ({ ...v, isActive: false })),
    });

    expect(container).toBeEmptyDOMElement();
  });
});
