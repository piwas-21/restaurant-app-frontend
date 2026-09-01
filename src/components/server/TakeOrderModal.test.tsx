import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TakeOrderModal from './TakeOrderModal';
import { getCategories, createServerOrder } from '@/services/serverService';
import { getProducts } from '@/services/menuService';
import { getMenuBundleById } from '@/services/menuBundleService';
import type { CustomizationResult } from './ProductCustomization';
import { ApiError } from '@/utils/apiClient';

// Stub react-i18next so t() returns the inline fallback (fallback ?? key),
// matching how the component renders without an i18next provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

// Menu + server services are exercised on mount and on submit; mock the async
// calls but keep the pure point-math helpers real (requireActual).
jest.mock('@/services/menuService', () => ({
  getProducts: jest.fn(),
}));

// A menu parent opens from the BUNDLE contract (`GET /api/Menus/{id}`), which carries each option's
// recipe and sauce rule; the product read projects those away (see `useWaiterMenu`).
jest.mock('@/services/menuBundleService', () => ({
  getMenuBundleById: jest.fn(),
}));

jest.mock('@/services/serverService', () => {
  const actual = jest.requireActual('@/services/serverService');
  return {
    ...actual,
    getCategories: jest.fn(),
    createServerOrder: jest.fn(),
    searchUsers: jest.fn(),
    getUserFidelityBalance: jest.fn(),
    getUserDiscountRules: jest.fn(),
  };
});

// Replace the customization modal with a deterministic confirm button so the
// tests drive the orchestrator/hook without ProductCustomization's own fetch.
jest.mock('./ProductCustomization', () => ({
  __esModule: true,
  default: function MockProductCustomization({
    product,
    isOpen,
    onClose,
    onConfirm,
  }: {
    product: { id: string; basePrice: number };
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (result: CustomizationResult) => void;
  }) {
    if (!isOpen) return null;
    return (
      <div data-testid="product-customization">
        <button
          type="button"
          onClick={() =>
            onConfirm({
              productId: product.id,
              variationId: undefined,
              variationName: undefined,
              addedIngredients: [],
              removedIngredients: [],
              selectedIngredientIds: [],
              ingredientQuantities: {},
              sideItems: [],
              specialInstructions: undefined,
              finalPrice: product.basePrice,
            })
          }
        >
          confirm-customization
        </button>
        <button type="button" onClick={onClose}>
          close-customization
        </button>
      </div>
    );
  },
}));

jest.mock('./WaiterBundleCustomization', () => ({
  __esModule: true,
  default: function MockWaiterBundleCustomization({
    bundle,
    isOpen,
    onConfirm,
  }: {
    bundle: { menuDefinition: { sections: Array<{ id: string; items: Array<{ productId: string }> }> } };
    isOpen: boolean;
    onConfirm: (result: {
      selectedOptions: Array<{ sectionId: string; itemId: string; quantity: number }>;
      quantity: number;
      unitPrice: number;
    }) => void;
  }) {
    if (!isOpen) return null;
    const section = bundle.menuDefinition.sections[0];
    return (
      <div data-testid="bundle-customization">
        <button
          type="button"
          onClick={() =>
            onConfirm({
              selectedOptions: [{ sectionId: section.id, itemId: section.items[0].productId, quantity: 1 }],
              quantity: 1,
              unitPrice: 14,
            })
          }
        >
          confirm-bundle-customization
        </button>
      </div>
    );
  },
}));

const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockCreateServerOrder = createServerOrder as jest.MockedFunction<typeof createServerOrder>;
const mockGetProducts = getProducts as jest.MockedFunction<typeof getProducts>;
const mockGetMenuBundleById = getMenuBundleById as jest.MockedFunction<typeof getMenuBundleById>;

const categories = [
  { id: 'c1', name: 'Pizzas', description: '', displayOrder: 0, isActive: true },
  { id: 'c2', name: 'Drinks', description: '', displayOrder: 1, isActive: false },
];

const menuProducts = [
  {
    id: 'p1',
    name: 'Margherita',
    description: 'Classic',
    basePrice: 12,
    isActive: true,
    isAvailable: true,
    type: 'Food',
  },
  { id: 'p2', name: 'Cola', description: 'Fizzy', basePrice: 3, isActive: true, isAvailable: true, type: 'Drink' },
  {
    id: 'm1',
    name: 'Menu Sandwich Kebab',
    description: 'Menu',
    basePrice: 12,
    isActive: true,
    isAvailable: true,
    type: 'menu',
  },
];

const productsResponse = {
  success: true,
  message: '',
  data: { items: menuProducts, totalCount: menuProducts.length, page: 1, pageSize: 100, totalPages: 1 },
  errors: null,
};

const bundleDetailResponse = {
  success: true,
  data: {
    id: 'm1',
    name: 'Menu Sandwich Kebab',
    basePrice: 12,
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    type: 'menu',
    ingredients: [],
    allergens: [],
    displayOrder: 0,
    content: {},
    images: [],
    categories: [],
    variations: [],
    suggestedSideItems: [],
    menuDefinition: {
      id: 'definition',
      isAlwaysAvailable: true,
      availableMonday: true,
      availableTuesday: true,
      availableWednesday: true,
      availableThursday: true,
      availableFriday: true,
      availableSaturday: true,
      availableSunday: true,
      sections: [
        {
          id: 'plat',
          name: 'Plat',
          displayOrder: 0,
          isRequired: true,
          minSelection: 1,
          maxSelection: 1,
          items: [
            {
              id: 'sandwich-row',
              productId: 'sandwich-kebab',
              productName: 'Sandwich Kebab',
              additionalPrice: 2,
              displayOrder: 0,
              isDefault: false,
            },
          ],
        },
      ],
    },
  },
};

function setup() {
  const onClose = jest.fn();
  const onOrderCreated = jest.fn();
  render(<TakeOrderModal tableNumber="5" onClose={onClose} onOrderCreated={onOrderCreated} />);
  return { onClose, onOrderCreated };
}

// Add one product (p1) to the order via the stubbed customization modal.
async function addFirstProduct() {
  fireEvent.click(await screen.findByRole('button', { name: /Margherita/ }));
  fireEvent.click(screen.getByRole('button', { name: 'confirm-customization' }));
}

describe('TakeOrderModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCategories.mockResolvedValue(categories);
    mockGetProducts.mockResolvedValue(productsResponse as unknown as Awaited<ReturnType<typeof getProducts>>);
    mockGetMenuBundleById.mockResolvedValue(
      bundleDetailResponse as unknown as Awaited<ReturnType<typeof getMenuBundleById>>,
    );
    mockCreateServerOrder.mockResolvedValue({} as unknown as Awaited<ReturnType<typeof createServerOrder>>);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the header and the table label', async () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Take Order' })).toBeInTheDocument();
    expect(screen.getByText(/Table\s*5/)).toBeInTheDocument();
    await screen.findByText('Margherita');
  });

  it('loads active categories + available products and renders the grid', async () => {
    setup();
    expect(await screen.findByText('Margherita')).toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();
    // Active category is shown; the inactive one (Drinks) is filtered out.
    expect(screen.getByRole('button', { name: 'Pizzas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Drinks' })).not.toBeInTheDocument();
    expect(mockGetProducts).toHaveBeenCalledWith(1, 100, undefined, { includeMenus: true });
  });

  it('disables the submit button while the order is empty', async () => {
    setup();
    await screen.findByText('Margherita');
    expect(screen.getByText('No items added yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeDisabled();
  });

  it('opens the customization modal when a product is clicked', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Margherita/ }));
    expect(screen.getByTestId('product-customization')).toBeInTheDocument();
  });

  it('loads the menu definition and opens the bundle customization for a menu parent', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Menu Sandwich Kebab/ }));
    expect(await screen.findByTestId('bundle-customization')).toBeInTheDocument();
    expect(mockGetMenuBundleById).toHaveBeenCalledWith('m1');

    fireEvent.click(screen.getByRole('button', { name: 'confirm-bundle-customization' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place Order' }));

    await waitFor(() => expect(mockCreateServerOrder).toHaveBeenCalled());
    expect(mockCreateServerOrder.mock.calls[0][1]).toEqual([
      expect.objectContaining({
        productId: 'm1',
        unitPrice: 14,
        childItems: [expect.objectContaining({ productId: 'sandwich-kebab', unitPrice: 2, kind: 'BundleChild' })],
      }),
    ]);
  });

  it('adds an item to the summary when a customization is confirmed', async () => {
    setup();
    await addFirstProduct();
    // Margherita now appears twice: once in the grid, once in the summary line.
    expect(screen.getAllByText('Margherita')).toHaveLength(2);
    expect(screen.queryByText('No items added yet')).not.toBeInTheDocument();
    // The stubbed modal closed itself after confirm.
    expect(screen.queryByTestId('product-customization')).not.toBeInTheDocument();
  });

  it('increments, decrements, and removes an order line by index', async () => {
    setup();
    await addFirstProduct();
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText('2')).toBeInTheDocument();

    // Decrement uses the U+2212 minus glyph, exactly as in the source.
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '🗑️' }));
    expect(screen.getByText('No items added yet')).toBeInTheDocument();
    expect(screen.getAllByText('Margherita')).toHaveLength(1);
  });

  it('submits the order with the expected payload and fires the callbacks', async () => {
    const { onClose, onOrderCreated } = setup();
    await addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: 'Place Order' }));

    await waitFor(() => expect(onOrderCreated).toHaveBeenCalledTimes(1));
    expect(mockCreateServerOrder).toHaveBeenCalledWith(
      5,
      [
        {
          productId: 'p1',
          productVariationId: undefined,
          quantity: 1,
          unitPrice: 12,
          specialInstructions: undefined,
          // #595 — the line now says what it is made of. The stub above confirms an EMPTY
          // selection, and empty is a real answer the server prices: it is sent, not omitted.
          selectedIngredientIds: [],
          ingredientQuantities: {},
          // No side was chosen, so the key is absent-as-undefined — a plain line posts what it
          // always did.
          childItems: undefined,
        },
      ],
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the SERVER's reason when order creation fails", async () => {
    mockCreateServerOrder.mockRejectedValueOnce(new ApiError(400, 'Table 5 already has an open order'));
    const { onOrderCreated } = setup();
    await addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: 'Place Order' }));

    expect(await screen.findByText('Table 5 already has an open order')).toBeInTheDocument();
    expect(onOrderCreated).not.toHaveBeenCalled();
  });

  // A plain `Error` here is a CLIENT-side bug, and its text ("Cannot read properties of undefined")
  // is not something to put in front of a server taking an order. `getErrorMessage` returns null
  // for it on purpose (#401), so the contextual fallback is what shows.
  it('falls back to its own sentence for a client-side throw', async () => {
    mockCreateServerOrder.mockRejectedValueOnce(new TypeError('x.map is not a function'));
    const { onOrderCreated } = setup();
    await addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: 'Place Order' }));

    expect(await screen.findByText('Failed to create order')).toBeInTheDocument();
    expect(screen.queryByText('x.map is not a function')).not.toBeInTheDocument();
    expect(onOrderCreated).not.toHaveBeenCalled();
  });
});
