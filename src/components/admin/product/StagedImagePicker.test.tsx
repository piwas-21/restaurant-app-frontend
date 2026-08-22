import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StagedImagePicker from './StagedImagePicker';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const file = (name: string, type: string, size = 1000): File => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

const renderPicker = (files: File[] = []) => {
  const onChange = jest.fn();
  const { container } = render(
    <StagedImagePicker inputId="product-images" label="product_images" files={files} onChange={onChange} />,
  );
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  return { onChange, input };
};

describe('StagedImagePicker — the create route, pre-checked (Track F, F1c)', () => {
  it('offers only what the server stores', () => {
    const { input } = renderPicker();

    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });

  it('passes acceptable files up and says nothing', () => {
    const { onChange, input } = renderPicker();

    fireEvent.change(input, { target: { files: [file('a.jpg', 'image/jpeg')] } });

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'a.jpg' })]);
    expect(screen.queryByText('images_too_large')).not.toBeInTheDocument();
    expect(screen.queryByText('images_wrong_type')).not.toBeInTheDocument();
  });

  // The silent version of this is the bug: the file was staged, sent, refused with HTTP 200,
  // and the admin was told nothing.
  it('names what it refused and stages only the rest', () => {
    const { onChange, input } = renderPicker();

    fireEvent.change(input, {
      target: {
        files: [
          file('camera.heic', 'image/heic'),
          file('huge.jpg', 'image/jpeg', 11 * 1024 * 1024),
          file('ok.png', 'image/png'),
        ],
      },
    });

    // Both reasons in one line — they have different remedies (shrink it / export it as JPEG).
    expect(screen.getByText('images_too_large images_wrong_type')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'ok.png' })]);
  });

  it('reports the staged count once the parent holds files', () => {
    renderPicker([file('a.jpg', 'image/jpeg')]);

    expect(screen.getByText('files_selected')).toBeInTheDocument();
  });
});
