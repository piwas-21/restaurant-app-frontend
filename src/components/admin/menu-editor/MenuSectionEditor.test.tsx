import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import MenuSectionEditor from './MenuSectionEditor';
import { MenuSection } from '@/types/menu';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key) }),
}));

const section = (name: string, over: Partial<MenuSection> = {}): MenuSection => ({
  id: `sec-${name}`,
  name,
  description: '',
  displayOrder: 0,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [],
  ...over,
});

describe('MenuSectionEditor — removing from Menu Sections', () => {
  it('removes a whole section after the confirmation, and propagates the removal', () => {
    const onChange = jest.fn();
    render(
      <MenuSectionEditor
        sections={[section('Mains', { displayOrder: 0 }), section('Drinks', { displayOrder: 1 })]}
        onChange={onChange}
      />,
    );

    const mainsCard = screen.getByText('Mains').closest('div[class*="sectionCard"]') as HTMLElement;
    fireEvent.click(within(mainsCard).getByTitle('delete_section'));

    expect(screen.getByText('Are you sure you want to delete this section?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'Drinks' })]);
    expect(screen.queryByText('Mains')).not.toBeInTheDocument();
  });

  it('removes an item from a section after the confirmation, and propagates the removal', () => {
    const onChange = jest.fn();
    const mains = section('Mains', {
      items: [
        { id: 'item-1', productId: 'p1', productName: 'Kebab', additionalPrice: 0, displayOrder: 0, isDefault: true },
      ],
    });
    render(<MenuSectionEditor sections={[mains]} onChange={onChange} />);

    // The section body (and with it the items table) is only rendered while expanded.
    fireEvent.click(screen.getByTitle('expand'));
    fireEvent.click(screen.getByTitle('remove_item'));

    expect(screen.getByText('Are you sure you want to remove this item?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ items: [] })]);
    expect(screen.queryByText('Kebab')).not.toBeInTheDocument();
  });
});
