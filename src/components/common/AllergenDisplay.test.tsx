import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AllergenDisplay from './AllergenDisplay';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

describe('AllergenDisplay', () => {
  // The regression this file exists for. `full` used to answer an empty allergen list with a
  // `visibility: hidden` label plus a placeholder chip, which reserved ~80px of blank card on every
  // item that carries no allergens — taller than a populated band, and the gap the card's details
  // affordance was left floating in. Nothing asserted it, so nothing would have caught its return.
  it.each(['full', 'compact', 'admin'] as const)('renders nothing for %s when there are no allergens', (variant) => {
    const { container } = render(<AllergenDisplay allergens={[]} variant={variant} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for full when allergens is undefined', () => {
    const { container } = render(<AllergenDisplay variant="full" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('still renders the chips when there ARE allergens', () => {
    render(<AllergenDisplay allergens={['vegan', 'gluten']} variant="full" />);

    const group = screen.getByRole('group', { name: 'Allergens' });
    expect(group).toBeInTheDocument();
    expect(screen.getByText('vegan')).toBeInTheDocument();
    expect(screen.getByText('gluten')).toBeInTheDocument();
  });

  it('caps the chips at maxVisible and counts the rest', () => {
    render(<AllergenDisplay allergens={['vegan', 'gluten', 'milk', 'nuts']} variant="full" maxVisible={2} />);

    expect(screen.getByText('vegan')).toBeInTheDocument();
    expect(screen.getByText('gluten')).toBeInTheDocument();
    expect(screen.queryByText('milk')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
