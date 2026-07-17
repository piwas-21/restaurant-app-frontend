import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TakeOrderModal from './TakeOrderModal';
import { getCategories, createServerOrder } from '@/services/serverService';
import { getProducts } from '@/services/menuService';
import type { CustomizationResult } from './ProductCustomization';

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
  getProductById: jest.fn(),
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
              excludedIngredients: [],
              addedIngredients: [],
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

const mockGetCategories = getCategories as jest.MockedFunction<typeof getCategories>;
const mockCreateServerOrder = createServerOrder as jest.MockedFunction<typeof createServerOrder>;
const mockGetProducts = getProducts as jest.MockedFunction<typeof getProducts>;

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
];

const productsResponse = {
  success: true,
  message: '',
  data: { items: menuProducts, totalCount: menuProducts.length, page: 1, pageSize: 100, totalPages: 1 },
  errors: null,
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
    expect(mockGetProducts).toHaveBeenCalledWith(1, 100, undefined);
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
      [{ productId: 'p1', productVariationId: undefined, quantity: 1, unitPrice: 12, specialInstructions: undefined }],
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the error string when order creation fails', async () => {
    mockCreateServerOrder.mockRejectedValueOnce(new Error('Kitchen offline'));
    const { onOrderCreated } = setup();
    await addFirstProduct();

    fireEvent.click(screen.getByRole('button', { name: 'Place Order' }));

    expect(await screen.findByText('Kitchen offline')).toBeInTheDocument();
    expect(onOrderCreated).not.toHaveBeenCalled();
  });
});
