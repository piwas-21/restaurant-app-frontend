import '@testing-library/jest-dom';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
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

    const thumb = screen.getAllByAltText('Adana Kebab')[0];
    fireEvent.click(thumb.closest('div') as HTMLElement);

    // Lightbox opens; multi-image → nav present.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Image' })).toBeInTheDocument();
  });

  it('falls back to the single primary image when no gallery array is provided', () => {
    render(<MenuCardImage imageUrl="solo.jpg" alt="Hummus" enlargeLabel="Enlarge Hummus image" />);
    const thumb = screen.getAllByAltText('Hummus')[0];
    fireEvent.click(thumb.closest('div') as HTMLElement);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Single image → no navigation.
    expect(screen.queryByRole('button', { name: 'Next Image' })).not.toBeInTheDocument();
  });

  it('exposes the thumbnail as a labelled button and opens via keyboard (Space is prevented from scrolling)', () => {
    render(<MenuCardImage imageUrl="hero.jpg" alt="Adana Kebab" enlargeLabel="Enlarge Adana Kebab image" />);

    // The clickable image is a button with a DISTINCT accessible name — not the
    // dish name, which is the card title's name — so it is keyboard-focusable
    // and unambiguous for screen readers and role-based test lookups.
    const button = screen.getByRole('button', { name: 'Enlarge Adana Kebab image' });
    expect(button).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const space = createEvent.keyDown(button, { key: ' ' });
    fireEvent(button, space);

    // Space activates the button (opens the lightbox) and its default page-scroll is suppressed.
    expect(space.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
