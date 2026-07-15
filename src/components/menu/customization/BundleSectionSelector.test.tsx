import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import BundleSectionSelector from './BundleSectionSelector';
import type { MenuSection, SelectedMenuOption } from '@/types/menu';

// Stub react-i18next without a provider. A string second argument is i18next's defaultValue; an
// object is interpolation, which we render as `key(a=1)` so tests can assert the values actually
// reach the translation rather than being concatenated around it.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: unknown) => {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg === 'object') {
        return `${key}(${Object.entries(arg)
          .map(([name, value]) => `${name}=${value}`)
          .join(',')})`;
      }
      return key;
    },
  }),
}));

const cheese = {
  id: 'cheese',
  name: 'Cheese',
  price: 2,
  isOptional: true,
  isActive: true,
  isIncludedInBasePrice: true,
  maxQuantity: 3,
  displayOrder: 1,
};

const section: MenuSection = {
  id: 'main',
  name: 'Choose a main',
  description: 'One per combo',
  displayOrder: 1,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [
    {
      id: 'si-burger',
      productId: 'burger',
      productName: 'Burger',
      additionalPrice: 4,
      displayOrder: 1,
      isDefault: true,
      detailedIngredients: [cheese],
    },
    { id: 'si-wrap', productId: 'wrap', productName: 'Wrap', additionalPrice: 0, displayOrder: 2, isDefault: false },
  ],
};

const multiSection: MenuSection = {
  ...section,
  id: 'sides',
  name: 'Sides',
  minSelection: 0,
  maxSelection: 1,
  isRequired: false,
  items: [
    { id: 'si-fries', productId: 'fries', productName: 'Fries', additionalPrice: 2, displayOrder: 1, isDefault: false },
    { id: 'si-salad', productId: 'salad', productName: 'Salad', additionalPrice: 3, displayOrder: 2, isDefault: false },
  ],
};

const props = (over: Partial<React.ComponentProps<typeof BundleSectionSelector>> = {}) => ({
  section,
  selectedOptions: [] as SelectedMenuOption[],
  expandedOptionKey: null,
  currentLanguage: 'en',
  onToggleOption: jest.fn(),
  onToggleExpanded: jest.fn(),
  onCustomizationChange: jest.fn(),
  ...over,
});

describe('BundleSectionSelector', () => {
  it('renders a radio group for a single-choice section, marked required', () => {
    render(<BundleSectionSelector {...props()} />);

    expect(screen.getByText('Choose a main')).toBeInTheDocument();
    expect(screen.getByText('One per combo')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByLabelText('required')).toBeInTheDocument();
  });

  it('renders a checkbox group when more than one pick is allowed', () => {
    render(<BundleSectionSelector {...props({ section: { ...multiSection, maxSelection: 2 } })} />);

    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('shows the option surcharge and reports a pick', () => {
    const onToggleOption = jest.fn();
    render(<BundleSectionSelector {...props({ onToggleOption })} />);

    expect(screen.getByText('+CHF 4.00')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('radio')[0]);
    expect(onToggleOption).toHaveBeenCalledWith(section, 'burger');
  });

  it('disables only the unpicked options once a checkbox section is at maxSelection', () => {
    const cappedSection: MenuSection = {
      ...multiSection,
      maxSelection: 2,
      items: [
        ...multiSection.items,
        {
          id: 'si-soup',
          productId: 'soup',
          productName: 'Soup',
          additionalPrice: 4,
          displayOrder: 3,
          isDefault: false,
        },
      ],
    };
    const selectedOptions = [
      { sectionId: 'sides', itemId: 'fries', quantity: 1 },
      { sectionId: 'sides', itemId: 'salad', quantity: 1 },
    ];
    render(<BundleSectionSelector {...props({ section: cappedSection, selectedOptions })} />);

    // The two picks stay clickable (so they can be un-picked); only the third is barred.
    expect(screen.getByRole('checkbox', { name: /Fries/ })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /Salad/ })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /Soup/ })).toBeDisabled();
  });

  it('renders the section error only when one is supplied', () => {
    const { rerender } = render(<BundleSectionSelector {...props()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<BundleSectionSelector {...props({ minSelectionError: 1 })} />);
    // The count is interpolated into the key, not concatenated around it — so a locale that puts
    // the number elsewhere in the sentence still reads correctly.
    expect(screen.getByRole('alert')).toHaveTextContent('please_select_at_least_options(count=1)');
  });

  it('interpolates the selection hint rather than concatenating translated fragments', () => {
    const { rerender } = render(<BundleSectionSelector {...props()} />);
    // minSelection === maxSelection → the single-count phrasing.
    expect(screen.getByText(/choose_count\(count=1\)/)).toBeInTheDocument();

    rerender(<BundleSectionSelector {...props({ section: { ...section, minSelection: 1, maxSelection: 3 } })} />);
    expect(screen.getByText(/choose_range\(min=1,max=3\)/)).toBeInTheDocument();
  });

  it('offers the drill-in only for a selected option that has ingredients', () => {
    const onToggleExpanded = jest.fn();
    const { rerender } = render(<BundleSectionSelector {...props({ onToggleExpanded })} />);
    // Nothing selected yet → no Customize affordance.
    expect(screen.queryByRole('button', { name: 'customize' })).not.toBeInTheDocument();

    const selectedOptions = [{ sectionId: 'main', itemId: 'burger', quantity: 1 }];
    rerender(<BundleSectionSelector {...props({ selectedOptions, onToggleExpanded })} />);

    const customize = screen.getByRole('button', { name: 'customize' });
    expect(customize).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(customize);
    expect(onToggleExpanded).toHaveBeenCalledWith('main', 'burger');
  });

  it('never offers the drill-in for an option with no ingredients', () => {
    const selectedOptions = [{ sectionId: 'main', itemId: 'wrap', quantity: 1 }];
    render(<BundleSectionSelector {...props({ selectedOptions })} />);

    expect(screen.queryByRole('button', { name: 'customize' })).not.toBeInTheDocument();
  });

  it('expands the ingredients inline — not in a nested modal — and reports a change', () => {
    const onCustomizationChange = jest.fn();
    const selectedOptions = [
      {
        sectionId: 'main',
        itemId: 'burger',
        quantity: 1,
        selectedIngredients: ['cheese'],
        ingredientQuantities: { cheese: 1 },
      },
    ];
    render(
      <BundleSectionSelector
        {...props({ selectedOptions, expandedOptionKey: 'main::burger', onCustomizationChange })}
      />,
    );

    const cheeseBox = screen.getByRole('checkbox', { name: /Cheese/ });
    expect(cheeseBox).toBeChecked();

    // Deselecting an included-in-base optional must report the removal, so the kitchen ticket can
    // print "NO Cheese" (backend derives IsRemoved from quantity 0 — issue #150).
    fireEvent.click(cheeseBox);
    expect(onCustomizationChange).toHaveBeenCalledWith('main', 'burger', { selectedIngredients: [] });
    expect(onCustomizationChange).toHaveBeenCalledWith('main', 'burger', { ingredientQuantities: { cheese: 0 } });
  });
});
