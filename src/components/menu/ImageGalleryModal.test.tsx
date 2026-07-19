import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ImageGalleryModal from './ImageGalleryModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

const imgs = [
  { url: 'a.jpg', alt: 'Photo A' },
  { url: 'b.jpg', alt: 'Photo B' },
];

type Overrides = Partial<{ isOpen: boolean; images: typeof imgs; currentIndex: number }>;

const setup = (over: Overrides = {}) => {
  const props = {
    isOpen: true,
    images: imgs,
    currentIndex: 0,
    title: 'Adana Kebab',
    onClose: jest.fn(),
    onNext: jest.fn(),
    onPrev: jest.fn(),
    ...over,
  };
  render(<ImageGalleryModal {...props} />);
  return props;
};

describe('ImageGalleryModal', () => {
  it('renders nothing when closed', () => {
    setup({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing when there are no images', () => {
    setup({ images: [] });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the current image + prev/next + counter for a multi-image item', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByAltText('Photo A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous Image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Image' })).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('hides nav + counter for a single-image item', () => {
    setup({ images: [imgs[0]] });
    expect(screen.getByAltText('Photo A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next Image' })).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('calls onNext/onPrev on click and arrow keys', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next Image' }));
    expect(p.onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Previous Image' }));
    expect(p.onPrev).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(p.onNext).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(p.onPrev).toHaveBeenCalledTimes(2);
  });
});
