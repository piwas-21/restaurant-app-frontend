import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import MenuPageHeader from './MenuPageHeader';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

describe('MenuPageHeader', () => {
  it('renders a visually-hidden h1 landmark and no decorative icon', () => {
    const { container } = render(<MenuPageHeader />);

    const h1 = screen.getByRole('heading', { level: 1, name: 'Our Menu' });
    expect(h1).toHaveAttribute('id', 'menu-page-heading');
    expect(h1).toHaveClass('sr-only');
    // The fork-and-knife SVG icon is gone.
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
