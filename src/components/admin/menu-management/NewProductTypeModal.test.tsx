import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NewProductTypeModal from './NewProductTypeModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('NewProductTypeModal — the create-entry type choice (slice 7 PR2e)', () => {
  it('selects a plain item', () => {
    const onSelect = jest.fn();
    render(<NewProductTypeModal isOpen onClose={jest.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'create_new_product' }));

    expect(onSelect).toHaveBeenCalledWith(false);
  });

  it('selects a bundle', () => {
    const onSelect = jest.fn();
    render(<NewProductTypeModal isOpen onClose={jest.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'create_new_menu_bundle' }));

    expect(onSelect).toHaveBeenCalledWith(true);
  });

  it('renders nothing when closed', () => {
    render(<NewProductTypeModal isOpen={false} onClose={jest.fn()} onSelect={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'create_new_product' })).not.toBeInTheDocument();
  });
});
