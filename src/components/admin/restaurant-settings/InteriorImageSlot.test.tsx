import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import InteriorImageSlot from './InteriorImageSlot';

jest.mock('react-i18next', () => ({
  // The keys ARE the assertions — a translated string would let a wrong key pass by
  // rendering some other locale value that happens to read plausibly.
  useTranslation: () => ({ t: (key: string) => key }),
}));

const noop = () => {};

describe('InteriorImageSlot', () => {
  it('says there is no photo instead of previewing a stand-in image', () => {
    // The whole reason this is not LogoSlot. An empty logo slot previews the restaurant
    // NAME because that is what the header really renders; an empty photo slot has nothing
    // to preview because the landing page renders NOTHING, and a grey placeholder here
    // would suggest the visitor sees one.
    render(
      <InteriorImageSlot
        currentUrl={null}
        restaurantName="Kebab Dilhan"
        isBusy={false}
        onUpload={noop}
        onRemove={noop}
      />,
    );

    expect(screen.getByText('interior_photo_empty')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('offers no Remove until there is something to remove', () => {
    render(
      <InteriorImageSlot
        currentUrl={null}
        restaurantName="Kebab Dilhan"
        isBusy={false}
        onUpload={noop}
        onRemove={noop}
      />,
    );

    expect(screen.queryByRole('button', { name: 'logo_remove' })).not.toBeInTheDocument();
    expect(screen.getByText('logo_upload')).toBeInTheDocument();
  });

  it('previews the stored photo and switches the picker to Replace', () => {
    render(
      <InteriorImageSlot
        currentUrl="https://example.test/branding/interior.png"
        restaurantName="Kebab Dilhan"
        isBusy={false}
        onUpload={noop}
        onRemove={noop}
      />,
    );

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText('logo_replace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'logo_remove' })).toBeInTheDocument();
  });

  it('clears the file input so the SAME file can be picked again after a failure', () => {
    // Without the reset, an upload that failed cannot be retried with the identical file:
    // re-picking it fires no change event, so the admin has to choose another file first.
    const onUpload = jest.fn();
    render(
      <InteriorImageSlot
        currentUrl={null}
        restaurantName="Kebab Dilhan"
        isBusy={false}
        onUpload={onUpload}
        onRemove={noop}
      />,
    );
    const input = screen.getByLabelText('logo_upload') as HTMLInputElement;
    const file = new File(['x'], 'interior.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
  });

  it('disables the picker while an upload is in flight', () => {
    render(
      <InteriorImageSlot
        currentUrl="https://example.test/branding/interior.png"
        restaurantName="Kebab Dilhan"
        isBusy
        onUpload={noop}
        onRemove={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'logo_remove' })).toBeDisabled();
  });
});
