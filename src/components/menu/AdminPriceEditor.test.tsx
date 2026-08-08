import '@testing-library/jest-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CatalogItem } from '@/types/menu';
import { useOptionalAuth } from '@/components/AuthContext';
import { updateProductPrice } from '@/services/productService';
import AdminPriceEditor from './AdminPriceEditor';
// Resolves to `__mocks__/@/utils/apiClient.ts`, which shadows the real module tree-wide — the same
// class object the component's `getErrorMessage` checks with `instanceof`. Constructing one from
// anywhere else makes that check false and the assertion vacuous.
import { ApiError } from '@/utils/apiClient';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: jest.fn(() => null) }));
jest.mock('@/services/productService', () => ({ updateProductPrice: jest.fn() }));

const asAdmin = () => (useOptionalAuth as jest.Mock).mockReturnValue({ user: { role: 'Admin' }, isLoading: false });

const product = (over: Partial<CatalogItem> = {}): CatalogItem =>
  ({
    kind: 'product',
    id: 'p1',
    name: 'Margherita',
    price: 12.5,
    isBundle: false,
    priceEditability: 'editable',
    ...over,
  }) as CatalogItem;

describe('AdminPriceEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOptionalAuth as jest.Mock).mockReturnValue(null);
  });

  it('renders nothing for a guest', () => {
    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
  });

  // The reported bug: this used to render NOTHING, so an admin could not tell a deliberate refusal
  // from a missing feature. It now always says something.
  it.each([
    ['variations', 'Price is set per variation'],
    ['bundle', "A combo's price comes from the items in it"],
  ] as const)('explains the refusal instead of vanishing when editability is %s', (editability, reason) => {
    asAdmin();
    render(<AdminPriceEditor item={product({ priceEditability: editability })} onPriceChange={jest.fn()} />);

    expect(screen.queryByTestId('admin-edit-price')).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-edit-price-locked')).toHaveTextContent(reason);
  });

  // A combo used to reach the editor with `priceEditable: undefined`, which is also `!== true` —
  // same blank outcome, different cause. Pinned separately because the mapper is what changed.
  it('still renders nothing for a guest, whatever the editability', () => {
    render(<AdminPriceEditor item={product({ priceEditability: 'bundle' })} onPriceChange={jest.fn()} />);
    expect(screen.queryByTestId('admin-edit-price-locked')).not.toBeInTheDocument();
  });

  it('shows a written label, not a bare glyph', () => {
    asAdmin();
    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    expect(screen.getByTestId('admin-edit-price')).toHaveTextContent('Edit price');
  });

  it('saves a new price and reports the backend-echoed value', async () => {
    asAdmin();
    (updateProductPrice as jest.Mock).mockResolvedValue({ success: true, data: 14 });
    const onPriceChange = jest.fn();

    render(<AdminPriceEditor item={product()} onPriceChange={onPriceChange} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));

    // Seeded from the current price, so an admin edits rather than retypes.
    const input = screen.getByTestId('admin-price-input');
    expect(input).toHaveValue(12.5);

    fireEvent.change(input, { target: { value: '13.99' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    await waitFor(() => expect(updateProductPrice).toHaveBeenCalledWith('p1', 13.99));
    expect(onPriceChange).toHaveBeenCalledWith(14);
  });

  it('rejects a cleared field instead of retagging the item to 0.00', async () => {
    asAdmin();
    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));

    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    await waitFor(() => expect(screen.getByTestId('admin-price-input')).toHaveAttribute('aria-invalid', 'true'));
    expect(updateProductPrice).not.toHaveBeenCalled();
  });

  it('keeps the editor open and flags the field when the save fails', async () => {
    asAdmin();
    (updateProductPrice as jest.Mock).mockResolvedValue({ success: false });
    const onPriceChange = jest.fn();

    render(<AdminPriceEditor item={product()} onPriceChange={onPriceChange} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));
    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    await waitFor(() => expect(screen.getByTestId('admin-price-input')).toHaveAttribute('aria-invalid', 'true'));
    expect(onPriceChange).not.toHaveBeenCalled();
  });

  /**
   * `updateProductPrice` goes through `apiClient`, which THROWS on any non-2xx. The catch was
   * unbound, so a rejected save turned the border red and said nothing — the same swallow as
   * BUGS-IMPROVEMENTS-PLAN E9, on a second surface.
   */
  it('shows the reason a save was rejected, not just a red border', async () => {
    asAdmin();
    (updateProductPrice as jest.Mock).mockRejectedValue(new ApiError(400, 'Price must be below 1000'));

    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));
    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '5000' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    expect(await screen.findByTestId('admin-price-error')).toHaveTextContent('Price must be below 1000');
    // The message is wired to the input, so it is announced rather than merely painted.
    expect(screen.getByTestId('admin-price-input')).toHaveAttribute(
      'aria-describedby',
      screen.getByTestId('admin-price-error').id,
    );
  });

  it('names the rule when the typed value is not a price', async () => {
    asAdmin();

    render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />);
    fireEvent.click(screen.getByTestId('admin-edit-price'));
    fireEvent.change(screen.getByTestId('admin-price-input'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('admin-price-save'));

    expect(await screen.findByTestId('admin-price-error')).toHaveTextContent('Enter a price of 0 or more');
    // Guarded locally, so the empty field never reaches the server as a free 0.00.
    expect(updateProductPrice).not.toHaveBeenCalled();
  });

  /**
   * S14: what the host card is told, so it can mark itself.
   *
   * A boolean, not the control's full state. `'locked'` / `'editable'` would have had no consumer —
   * both hosts test only "is this open" — and an API that reports more than anyone reads is a
   * contract to keep working for free. Reviewed down from a four-member union for exactly that.
   */
  describe('editing state reported to the host', () => {
    it('reports false for a guest, who has no editor to open', () => {
      const onEditingChange = jest.fn();

      render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} onEditingChange={onEditingChange} />);

      expect(onEditingChange.mock.calls.flat()).toEqual([false]);
    });

    it('reports false for an admin whose price is locked, so a locked card is never marked', () => {
      asAdmin();
      const onEditingChange = jest.fn();

      render(
        <AdminPriceEditor
          item={product({ priceEditability: 'bundle' })}
          onPriceChange={jest.fn()}
          onEditingChange={onEditingChange}
        />,
      );

      expect(onEditingChange.mock.calls.flat()).toEqual([false]);
    });

    /**
     * The host wires this to a `useState` setter, which React re-renders on. If the effect were
     * keyed on anything that changes per render — an inline arrow, or a value rebuilt rather than
     * derived — that setter would fire again, re-render, and loop.
     *
     * So the assertion is the SEQUENCE, not the latest value: only a call count can see a render
     * loop, and this is the one contract in the prop's docblock that nothing type-checks.
     * Re-rendering with the same props must add nothing.
     */
    it('fires once per change, so a stable host callback cannot loop', () => {
      asAdmin();
      const onEditingChange = jest.fn();
      const view = render(
        <AdminPriceEditor item={product()} onPriceChange={jest.fn()} onEditingChange={onEditingChange} />,
      );

      expect(onEditingChange.mock.calls.flat()).toEqual([false]);

      view.rerender(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} onEditingChange={onEditingChange} />);
      expect(onEditingChange.mock.calls.flat()).toEqual([false]);

      fireEvent.click(screen.getByTestId('admin-edit-price'));
      expect(onEditingChange.mock.calls.flat()).toEqual([false, true]);
    });

    /**
     * Every way an edit can END, not just the one the UI makes obvious.
     *
     * This is why the callback is fired from an effect keyed on `editing` rather than from the
     * handlers: there are three exits, and a handler-by-handler implementation that missed one
     * would leave the card ringed with nothing open. Escape in particular has no button to attach
     * to — it is an inline `onKeyDown`.
     */
    it.each([
      ['Cancel', () => void fireEvent.click(screen.getByLabelText('Cancel'))],
      ['Escape', () => void fireEvent.keyDown(screen.getByTestId('admin-price-input'), { key: 'Escape' })],
    ])('reports false again when the edit ends via %s', async (_label, exit) => {
      asAdmin();
      const onEditingChange = jest.fn();

      render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} onEditingChange={onEditingChange} />);
      fireEvent.click(screen.getByTestId('admin-edit-price'));
      exit();

      await waitFor(() => expect(onEditingChange.mock.calls.flat()).toEqual([false, true, false]));
    });

    it('reports false again after a successful save', async () => {
      asAdmin();
      (updateProductPrice as jest.Mock).mockResolvedValue({ success: true, data: 14 });
      const onEditingChange = jest.fn();

      render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} onEditingChange={onEditingChange} />);
      fireEvent.click(screen.getByTestId('admin-edit-price'));
      fireEvent.click(screen.getByTestId('admin-price-save'));

      await waitFor(() => expect(onEditingChange.mock.calls.flat()).toEqual([false, true, false]));
    });

    /** Optional: every existing call site that does not care must keep working untouched. */
    it('is optional', () => {
      asAdmin();
      expect(() => render(<AdminPriceEditor item={product()} onPriceChange={jest.fn()} />)).not.toThrow();
    });
  });

  /**
   * The locked reason is a sentence, not a chip.
   *
   * Read from the stylesheet because the look is the whole point and no rendering test can see it.
   * It shipped with a hairline and a `--surface-secondary` fill, which is the shape of a status
   * badge. The screens do not settle it — four draw a locked reason and split 2-2 between bare text
   * (desktop light :327, desktop dark :198) and a filled chip (mobile dark :223, mobile RTL :283) —
   * so the tiebreak is internal consistency: S7 took the availability notice one row above from a
   * pill to a sentence, and the two cannot sit in one price row as a pill and a sentence.
   *
   * `background` and `border` are asserted absent from the RULE, with comments stripped first: this
   * slice's own comment names both properties in explaining their removal, so an unstripped read
   * finds the prose and reports the pill as still shipping.
   */
  it('draws the locked reason with no fill and no border', () => {
    const css = readFileSync(join(__dirname, 'AdminPriceEditor.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const start = css.indexOf('\n.locked {');
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('\n}', start));

    expect(rule).toContain('color: var(--text-secondary)');
    expect(rule).not.toMatch(/(?:^|\n)\s*background/);
    expect(rule).not.toMatch(/(?:^|\n)\s*border/);
  });

  /**
   * And the ring the host applies, asserted where it is declared.
   *
   * Three of the five screens ring; two use a brand border plus a wash. `outline` wins on two
   * grounds neither screen can see: both hosts already set `border` on this box, so a border would
   * have to win a cascade between two CSS Modules whose chunk order is not guaranteed (the
   * mechanism that shifted craft's checkout by 2px in S11); and a border participates in layout, so
   * on a grid of equal-height cards it would resize the card the moment an edit opened.
   */
  it('marks the host card with an outline rather than a border', () => {
    const css = readFileSync(join(__dirname, 'AdminPriceEditorHost.module.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const start = css.indexOf('\n.hostEditing {');
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('\n}', start));

    expect(rule).toContain('outline: 2px solid var(--brand-primary)');
    expect(rule).toContain('outline-offset: 2px');
    expect(rule).not.toMatch(/(?:^|\n)\s*border/);
  });
});
