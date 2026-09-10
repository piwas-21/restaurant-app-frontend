import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BundleMediaPanel from './BundleMediaPanel';

/**
 * The bundle CREATE route's staged Media section — its own contract: the staged picker, a
 * removable row per staged file, and the notice that says the upload happens on Save (nothing
 * here writes immediately — that is the gallery's behaviour on the EDIT route, and the notice
 * exists so the two surfaces can't be confused).
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) =>
      key === 'editor_media_remove_staged' && opts?.name ? `remove ${opts.name}` : key,
  }),
}));

const png = (name: string) => new File(['x'], name, { type: 'image/png' });

describe('BundleMediaPanel — the one image surface on the bundle editor', () => {
  it('renders the staged picker and the save-time upload notice', () => {
    render(<BundleMediaPanel files={[]} onChange={jest.fn()} />);

    expect(document.querySelector('#bundle-images')).not.toBeNull();
    expect(screen.getByText('editor_media_bundle_upload_notice')).toBeInTheDocument();
  });

  it('lists each staged file with a remove action that drops exactly that file', () => {
    const a = png('kebab-platter.png');
    const b = png('combo-table.png');
    const onChange = jest.fn();
    render(<BundleMediaPanel files={[a, b]} onChange={onChange} />);

    expect(screen.getByText('kebab-platter.png')).toBeInTheDocument();
    expect(screen.getByText('combo-table.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'remove combo-table.png' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([a]);
  });
});
