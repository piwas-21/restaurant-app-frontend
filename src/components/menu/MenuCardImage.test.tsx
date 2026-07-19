import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MenuCardImage from './MenuCardImage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

describe('MenuCardImage', () => {
  it('renders the thumbnail closed, then opens the gallery on image click', () => {
    render(
      <MenuCardImage
        imageUrl="hero.jpg"
        alt="Adana Kebab"
        images={[
          { url: 'hero.jpg', alt: 'Adana Kebab' },
          { url: 'two.jpg', alt: 'Adana 2' },
        ]}
        imageCount={2}
        countLabel="images"
      />,
    );
    // Lightbox is closed initially.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const thumb = screen.getAllByAltText('Adana Kebab')[0];
    fireEvent.click(thumb.closest('div') as HTMLElement);

    // Lightbox opens; multi-image → nav present.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Image' })).toBeInTheDocument();
  });

  it('falls back to the single primary image when no gallery array is provided', () => {
    render(<MenuCardImage imageUrl="solo.jpg" alt="Hummus" />);
    const thumb = screen.getAllByAltText('Hummus')[0];
    fireEvent.click(thumb.closest('div') as HTMLElement);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Single image → no navigation.
    expect(screen.queryByRole('button', { name: 'Next Image' })).not.toBeInTheDocument();
  });
});
