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
        enlargeLabel="Enlarge Adana Kebab image"
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

    fireEvent.click(screen.getByRole('button', { name: 'Enlarge Adana Kebab image' }));

    // Lightbox opens; multi-image → nav present.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Image' })).toBeInTheDocument();
  });

  it('falls back to the single primary image when no gallery array is provided', () => {
    render(<MenuCardImage imageUrl="solo.jpg" alt="Hummus" enlargeLabel="Enlarge Hummus image" />);
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge Hummus image' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Single image → no navigation.
    expect(screen.queryByRole('button', { name: 'Next Image' })).not.toBeInTheDocument();
  });

  it('exposes the thumbnail as a labelled native button (keyboard-accessible) and opens the lightbox', () => {
    render(<MenuCardImage imageUrl="hero.jpg" alt="Adana Kebab" enlargeLabel="Enlarge Adana Kebab image" />);

    // A real <button> with a DISTINCT accessible name — not the dish name, which
    // is the card title's — so it is natively focusable + Enter/Space activated
    // (keyboard-accessible with no custom key handling) and unambiguous for
    // screen-reader / role-based lookups.
    const button = screen.getByRole('button', { name: 'Enlarge Adana Kebab image' });
    expect(button.tagName).toBe('BUTTON');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
