import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductCustomization from './ProductCustomization';
import { getProductById } from '@/services/menuService';
import { ApiError } from '@/utils/apiClient';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));

const detail = (hideBaseProduct: boolean) => ({
  success: true,
  data: {
    id: 'p1',
    name: 'Günün tatlısı',
    basePrice: 6,
    hideBaseProduct,
    variations: [
      { id: 'sutlac', name: 'Sütlaç', priceModifier: 1, finalPrice: 7, isActive: true, displayOrder: 2 },
      { id: 'revani', name: 'Revani', priceModifier: 0, finalPrice: 6, isActive: true, displayOrder: 1 },
    ],
    detailedIngredients: [],
    suggestedSideItems: [],
    allergens: [],
  },
});

/**
 * Track F / F2, named risk 3 — this screen has no base row at all: "no variation" is expressed by
 * TAPPING THE SELECTED ONE AGAIN. For a product whose base is hidden that de-select builds a line
 * the server refuses (backend #399), so it has to be withheld here rather than 400 at the till.
 */
describe('ProductCustomization — a product that hides its base row', () => {
  const product = { id: 'p1', name: 'Günün tatlısı', basePrice: 6 } as never;

  const open = (hideBaseProduct: boolean) => {
    (getProductById as jest.Mock).mockResolvedValue(detail(hideBaseProduct));
    return render(<ProductCustomization product={product} isOpen onClose={jest.fn()} onConfirm={jest.fn()} />);
  };

  const variationButton = (name: string) => screen.getByText(name).closest('button') as HTMLButtonElement;

  it('opens on the first variation in display order, because nothing else is orderable', () => {
    open(true);

    return waitFor(() => expect(variationButton('Revani').className).toContain('selected'));
  });

  it('refuses to de-select it — tapping the chosen variation again keeps it', async () => {
    open(true);
    await waitFor(() => expect(variationButton('Revani').className).toContain('selected'));

    fireEvent.click(variationButton('Revani'));

    expect(variationButton('Revani').className).toContain('selected');
  });

  it('still lets staff switch to another variation', async () => {
    open(true);
    await waitFor(() => expect(variationButton('Revani').className).toContain('selected'));

    fireEvent.click(variationButton('Sütlaç'));

    expect(variationButton('Sütlaç').className).toContain('selected');
    expect(variationButton('Revani').className).not.toContain('selected');
  });

  it('leaves the ordinary product alone: no pre-selection, and de-select still works', async () => {
    open(false);
    await waitFor(() => expect(variationButton('Revani')).toBeInTheDocument());

    expect(variationButton('Revani').className).not.toContain('selected');

    fireEvent.click(variationButton('Revani'));
    expect(variationButton('Revani').className).toContain('selected');

    fireEvent.click(variationButton('Revani'));
    expect(variationButton('Revani').className).not.toContain('selected');
  });
});

/**
 * The sheet used to swallow its load failure: `catch (err) { console.error(...) }` in the component
 * — a BOUND catch, which `scripts/check-bare-catch.mjs` does not count — and, on the resolved
 * `success: false` shape, not even that (the `if (response.success && response.data)` had no else).
 * The waiter got a sheet that finished loading with no options, no reason, and since F2 not even a
 * pre-selected variation, mid-service, in front of a guest.
 */
describe('ProductCustomization — a sheet that could not load says why', () => {
  const product = { id: 'p1', name: 'Günün tatlısı', basePrice: 6 } as never;

  const openFailing = (failure: unknown, rejected = true) => {
    const mock = getProductById as jest.Mock;
    if (rejected) mock.mockRejectedValueOnce(failure);
    else mock.mockResolvedValueOnce(failure);
    return render(<ProductCustomization product={product} isOpen onClose={jest.fn()} onConfirm={jest.fn()} />);
  };

  it("shows the server's own reason when the fetch throws", async () => {
    openFailing(new ApiError(503, 'Menu service is restarting'));

    expect(await screen.findByTestId('customization-load-error')).toHaveTextContent('Menu service is restarting');
  });

  it('shows the reason when the refusal arrives inside a 200', async () => {
    openFailing(
      { success: false, message: 'Operation failed', errors: ['That product is no longer on the menu'] },
      false,
    );

    expect(await screen.findByTestId('customization-load-error')).toHaveTextContent(
      'That product is no longer on the menu',
    );
  });

  // The failure must not fall through to the empty-state branch: "This product has no customization
  // options" is a positive claim about the PRODUCT, made when the truth is that we failed to ask —
  // and the waiter's next tap then adds a plain line with no variation and no required side item.
  it('does not claim the product has no options when the truth is that we could not ask', async () => {
    openFailing(new ApiError(500, ''));

    await screen.findByTestId('customization-load-error');
    expect(screen.queryByText('This product has no customization options')).not.toBeInTheDocument();
    // Nothing server-authored to show, so the sheet says something of its own — translated, never
    // `getErrorMessage`'s old hardcoded English (E9).
    expect(screen.getByTestId('customization-load-error')).toHaveTextContent('Failed to load product details');
  });

  it('retries from the sheet, so a flaky till is not a closed order', async () => {
    // `mockReset` first: the suite above installs a PERSISTENT `mockResolvedValue`, which would
    // silently answer any extra call and hide a double-fetch behind a passing assertion.
    (getProductById as jest.Mock).mockReset();
    (getProductById as jest.Mock)
      .mockRejectedValueOnce(new ApiError(503, 'Menu service is restarting'))
      .mockResolvedValueOnce(detail(true));

    render(<ProductCustomization product={product} isOpen onClose={jest.fn()} onConfirm={jest.fn()} />);
    await screen.findByTestId('customization-load-error');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByTestId('customization-load-error')).not.toBeInTheDocument());
    // The options are back AND the sheet re-seeds itself: the retry path IS the first-load path
    // (one `load`, one attempt counter), so the F2 pre-selection cannot drift away from it.
    await waitFor(() => expect(screen.getByText('Revani').closest('button')?.className).toContain('selected'));
    // Exactly two requests: the failure and the retry. One `load` behind both.
    expect(getProductById).toHaveBeenCalledTimes(2);
  });
});
