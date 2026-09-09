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
  currentLanguage: 'en',
  onToggleOption: jest.fn(),
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

  // The guest sheet's Customize NAVIGATES — the sheet hosts the option's guided screen — so the
  // row's button is a plain button, not a disclosure (an aria-expanded would promise a panel on
  // this row that never appears).
  it('offers Customize only for a selected option that has ingredients, and raises it', () => {
    const onCustomizeOption = jest.fn();
    const { rerender } = render(<BundleSectionSelector {...props({ onCustomizeOption })} />);
    // Nothing selected yet → no Customize affordance.
    expect(screen.queryByRole('button', { name: 'customize' })).not.toBeInTheDocument();

    const selectedOptions = [{ sectionId: 'main', itemId: 'burger', quantity: 1 }];
    rerender(<BundleSectionSelector {...props({ selectedOptions, onCustomizeOption })} />);

    const customize = screen.getByRole('button', { name: 'customize' });
    expect(customize).not.toHaveAttribute('aria-expanded');

    fireEvent.click(customize);
    expect(onCustomizeOption).toHaveBeenCalledWith('main', 'burger');
  });

  it('never offers Customize for an option with no ingredients', () => {
    const selectedOptions = [{ sectionId: 'main', itemId: 'wrap', quantity: 1 }];
    render(<BundleSectionSelector {...props({ selectedOptions })} />);

    expect(screen.queryByRole('button', { name: 'customize' })).not.toBeInTheDocument();
  });

  // The staff modal keeps the INLINE panel — expanding in place is the counter shape. This is the
  // only consumer of the disclosure props.
  it('expands the option panel inline in staff mode, with a disclosure button, and reports a change', () => {
    const onChange = jest.fn();
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
        {...props({
          selectedOptions,
          onCustomizeOption: jest.fn(),
          inlinePanel: { expandedOptionKey: 'main::burger', onToggle: jest.fn(), onChange },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'customize' })).toHaveAttribute('aria-expanded', 'true');
    const cheeseBox = screen.getByRole('checkbox', { name: /Cheese/ });
    expect(cheeseBox).toBeChecked();

    // Deselecting an included-in-base optional must report the removal, so the kitchen ticket can
    // print "NO Cheese" (backend derives IsRemoved from quantity 0 — issue #150).
    fireEvent.click(cheeseBox);
    expect(onChange).toHaveBeenCalledWith('main', 'burger', { selectedIngredients: [] });
    expect(onChange).toHaveBeenCalledWith('main', 'burger', { ingredientQuantities: { cheese: 0 } });
  });

  it('flattens the fixed one-item Plat: guest mode raises Customize where the picker was', () => {
    const onCustomizeOption = jest.fn();
    const fixedPlat: MenuSection = { ...section, name: 'Plat', items: [section.items[0]] };
    const selectedOptions = [
      {
        sectionId: 'main',
        itemId: 'burger',
        quantity: 1,
        selectedIngredients: ['cheese'],
        ingredientQuantities: { cheese: 1 },
      },
    ];

    render(<BundleSectionSelector {...props({ section: fixedPlat, selectedOptions, onCustomizeOption })} />);

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'customize' }));
    expect(onCustomizeOption).toHaveBeenCalledWith('main', 'burger');
  });

  it('keeps the staff fixed Plat expanded in place, with no Customize button on top', () => {
    const fixedPlat: MenuSection = { ...section, name: 'Plat', items: [section.items[0]] };
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
        {...props({
          section: fixedPlat,
          selectedOptions,
          inlinePanel: { expandedOptionKey: null, onToggle: jest.fn(), onChange: jest.fn() },
        })}
      />,
    );

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'customize' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Cheese/ })).toBeChecked();
  });

  it('keeps a genuinely multi-choice Plat as a picker (P3 negative control)', () => {
    const multiChoicePlat: MenuSection = { ...section, name: 'Plat' };

    render(<BundleSectionSelector {...props({ section: multiChoicePlat })} />);

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByRole('checkbox', { name: /Cheese/ })).not.toBeInTheDocument();
  });
});
