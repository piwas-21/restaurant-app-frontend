import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CategoryOrderTypeMatrix from './CategoryOrderTypeMatrix';
import { useCategoryChannelsAdmin, CATEGORY_PAGE_SIZE } from '@/hooks/admin/useCategoryChannelsAdmin';
import { OrderType } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: unknown, maybeOpts?: unknown) => {
      const opts = (typeof fallbackOrOpts === 'object' ? fallbackOrOpts : maybeOpts) as
        Record<string, unknown> | undefined;
      const fallback =
        typeof fallbackOrOpts === 'string' ? fallbackOrOpts : ((opts?.defaultValue as string | undefined) ?? key);
      return fallback.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(opts?.[name] ?? ''));
    },
  }),
}));

// Only the hook is stubbed. CATEGORY_PAGE_SIZE is the REAL export — mocking it would let the
// notice and the cap drift apart while this file kept asserting its own mock back at itself.
jest.mock('@/hooks/admin/useCategoryChannelsAdmin', () => ({
  ...jest.requireActual('@/hooks/admin/useCategoryChannelsAdmin'),
  useCategoryChannelsAdmin: jest.fn(),
}));

const mockedHook = useCategoryChannelsAdmin as jest.Mock;

const category = { id: 'c1', name: 'Starters', productCount: 8, availableOrderTypes: null };

const hookState = (overrides: Record<string, unknown> = {}) => ({
  categories: [category],
  loading: false,
  savingId: null,
  truncated: false,
  selectedTypes: () => [OrderType.Takeaway],
  toggle: jest.fn(),
  isDirty: () => false,
  canSave: () => false,
  reset: jest.fn(),
  save: jest.fn(),
  ...overrides,
});

/**
 * The matrix had no test at all before E2 moved it onto the design system's `CheckboxField`. These
 * cover what a reader of the screen depends on — not the hook, which owns the state and is mocked.
 */
describe('CategoryOrderTypeMatrix', () => {
  it('names each checkbox with BOTH its row and its column', () => {
    // The bare `aria-label` this replaced gave a screen reader the same thing, but as an attribute
    // on a bare input — no label element, so the click target was the 13px box and nothing else.
    mockedHook.mockReturnValue(hookState());
    render(<CategoryOrderTypeMatrix />);

    expect(screen.getByRole('checkbox', { name: 'Starters available for Delivery' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Starters available for Takeaway' })).toBeChecked();
  });

  it('makes the whole cell clickable, not just the box', () => {
    const toggle = jest.fn();
    mockedHook.mockReturnValue(hookState({ toggle }));
    const { container } = render(<CategoryOrderTypeMatrix />);

    // Click the LABEL, which now fills the cell — the affordance the raw input did not have.
    const label = screen.getByRole('checkbox', { name: 'Starters available for Delivery' }).closest('label');
    expect(label).toBeInTheDocument();
    fireEvent.click(label as HTMLElement);

    expect(toggle).toHaveBeenCalledWith('c1', OrderType.Delivery);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
  });

  it('disables every box while a row is saving, so a second edit cannot race the request', () => {
    mockedHook.mockReturnValue(hookState({ savingId: 'c1' }));
    render(<CategoryOrderTypeMatrix />);

    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
  });

  it('warns on a row with no channel left, instead of silently taking it off sale', () => {
    mockedHook.mockReturnValue(hookState({ selectedTypes: () => [] }));
    render(<CategoryOrderTypeMatrix />);

    expect(screen.getByText(/Pick at least one order type/)).toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();
  });

  it('says so when the page cap hid categories, rather than truncating in silence', () => {
    mockedHook.mockReturnValue(hookState({ truncated: true }));
    render(<CategoryOrderTypeMatrix />);

    expect(
      screen.getByText(`Only the first ${CATEGORY_PAGE_SIZE} categories are shown. The rest cannot be edited yet.`),
    ).toBeInTheDocument();
  });

  it('renders the loading and empty states instead of an empty table', () => {
    mockedHook.mockReturnValue(hookState({ loading: true }));
    const { rerender } = render(<CategoryOrderTypeMatrix />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    mockedHook.mockReturnValue(hookState({ categories: [] }));
    rerender(<CategoryOrderTypeMatrix />);
    expect(screen.getByText('No categories found')).toBeInTheDocument();
  });
  it('routes the row actions to the row they belong to, and gates them on dirty/savable', () => {
    // One row saves at a time so an in-progress edit elsewhere survives — the buttons therefore
    // have to carry the row id, and a mis-wired one would silently save the wrong category.
    const reset = jest.fn();
    const save = jest.fn();
    mockedHook.mockReturnValue(hookState({ reset, save, isDirty: () => true, canSave: () => true }));
    render(<CategoryOrderTypeMatrix />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(reset).toHaveBeenCalledWith('c1');
    expect(save).toHaveBeenCalledWith('c1');
  });

  it('disables Cancel until the row is dirty and Save until it is savable', () => {
    mockedHook.mockReturnValue(hookState());
    render(<CategoryOrderTypeMatrix />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows the saving state on the row being saved', () => {
    mockedHook.mockReturnValue(hookState({ savingId: 'c1', isDirty: () => true, canSave: () => true }));
    render(<CategoryOrderTypeMatrix />);

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
  });
});
